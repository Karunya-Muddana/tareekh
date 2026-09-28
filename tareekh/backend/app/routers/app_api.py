"""Endpoints behind the app screens: the Today dashboard, the calendar, and chats with their own history."""
import datetime as dt
import json
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .. import chatmem, db, graph, memory, registry
from ..agent import agent
from ..config import today_iso

router = APIRouter()

CASE_SQL = """SELECT c.*, j.name AS judge_name, j.short AS judge_short, j.court_hall, o.name AS counsel_name,
                     cl.name AS client_name
              FROM cases c LEFT JOIN judges j ON j.id=c.judge_id LEFT JOIN counsel o ON o.id=c.opposing_counsel_id
              LEFT JOIN clients cl ON cl.id=c.client_id"""


def _last_entry(case_id: str, before: str) -> dict | None:
    """The most recent thing we know happened in a case: prefer the lawyer's own note over the order sheet."""
    return db.row("""SELECT hearing_date, doc_type, author, text, source_file FROM entries
                     WHERE case_id=? AND status='retained' AND hearing_date<? AND doc_type!='document'
                     ORDER BY hearing_date DESC, CASE doc_type WHEN 'order_sheet' THEN 1 ELSE 0 END LIMIT 1""",
                  case_id, before)


def _hearing_card(c: dict, today: str) -> dict:
    last = _last_entry(c["id"], today)
    return {"case_id": c["id"], "case_number": c["case_number"], "short_name": c["short_name"], "title": c["title"],
            "date": c["next_date"], "listed_for": c["stage"], "court_hall": c["court_hall"],
            "judge": c["judge_short"] or c["judge_name"], "judge_id": c["judge_id"], "counsel": c["counsel_name"],
            "client": c["client_name"], "represents": c["represents"],
            "last": last and {"date": last["hearing_date"], "by": last["author"], "text": last["text"][:420],
                              "source_file": last["source_file"]}}


@router.get("/today")
def today():
    t = today_iso()
    horizon = (dt.date.fromisoformat(t) + dt.timedelta(days=21)).isoformat()
    cases = db.rows(CASE_SQL + " WHERE c.next_date IS NOT NULL AND c.next_date!='' AND c.next_date>=? AND c.next_date<=? "
                               "ORDER BY c.next_date, c.judge_id", t, horizon)
    todays = [_hearing_card(c, t) for c in cases if c["next_date"] == t]
    upcoming = [_hearing_card(c, t) for c in cases if c["next_date"] != t]
    judges = {}
    for h in todays:
        judges.setdefault(h["judge_id"], {"name": h["judge"], "profile": None})
    recent = db.rows("""SELECT e.case_id, e.hearing_date, e.author, e.doc_type, substr(e.text, 1, 200) AS text
                        FROM entries e WHERE e.status='retained' AND e.doc_type!='document'
                        ORDER BY e.hearing_date DESC LIMIT 5""")
    # Only local data here, so the screen draws at once. What memory has learned (judge profiles,
    # open commitments) is a network round-trip per model and comes from /today/insights.
    return {"today": t, "practice": registry.practice(), "hearings": todays, "upcoming": upcoming, "judges": judges,
            "commitments": None, "recent": recent}


_INSIGHTS_TTL = 120.0
_insights_cache: dict[str, tuple[float, str | None]] = {}
_insights_lock = threading.Lock()


def _mental_model_cached(mm_id: str) -> str | None:
    """Mental models change only when Hindsight re-consolidates, so a couple of minutes of staleness is fine."""
    now = time.monotonic()
    with _insights_lock:
        hit = _insights_cache.get(mm_id)
    if hit and now - hit[0] < _INSIGHTS_TTL:
        return hit[1]
    text = memory.get_mental_model_text(mm_id)
    with _insights_lock:
        _insights_cache[mm_id] = (time.monotonic(), text)
    return text


@router.get("/today/insights")
def today_insights():
    t = today_iso()
    rows = db.rows(CASE_SQL + " WHERE c.next_date=?", t)
    names = {}
    for c in rows:
        names.setdefault(c["judge_id"], c["judge_short"] or c["judge_name"])
    ids = ["open-commitments"] + [memory.mental_model_id("judge", j) for j in names]
    with ThreadPoolExecutor(max_workers=min(8, len(ids))) as pool:   # one Hindsight call per model, in parallel
        texts = dict(zip(ids, pool.map(_mental_model_cached, ids)))
    return {"commitments": texts["open-commitments"],
            "judges": {j: {"name": n, "profile": texts[memory.mental_model_id("judge", j)]} for j, n in names.items()}}


@router.get("/calendar")
def calendar(month: str | None = None):
    """Hearings in a month: past ones from saved notes, future ones from each case's next date."""
    month = (month or today_iso())[:7]
    past = db.rows("""SELECT DISTINCT case_id, hearing_date AS date FROM entries
                      WHERE status='retained' AND doc_type!='document' AND substr(hearing_date,1,7)=?""", month)
    future = db.rows("SELECT id AS case_id, next_date AS date FROM cases WHERE substr(next_date,1,7)=?", month)
    names = {c["id"]: c["short_name"] for c in db.rows("SELECT id, short_name FROM cases")}
    seen, events = set(), []
    for kind, rows in (("hearing", past), ("listed", future)):
        for r in rows:
            if (r["case_id"], r["date"]) in seen or not r["case_id"]:
                continue
            seen.add((r["case_id"], r["date"]))
            events.append({"date": r["date"], "case_id": r["case_id"], "short_name": names.get(r["case_id"], r["case_id"]), "kind": kind})
    return {"month": month, "today": today_iso(), "events": sorted(events, key=lambda e: (e["date"], e["case_id"]))}


# ------------------------------------------------------------------ chats
def _now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


class ChatIn(BaseModel):
    title: str | None = None
    case_id: str | None = None


@router.get("/chats")
def list_chats():
    return db.rows("""SELECT c.id, c.title, c.case_id, c.updated_at,
                             (SELECT substr(content,1,120) FROM messages m WHERE m.chat_id=c.id ORDER BY m.id DESC LIMIT 1) AS last
                      FROM chats c ORDER BY c.updated_at DESC""")


@router.post("/chats")
def create_chat(body: ChatIn):
    cid = uuid.uuid4().hex[:10]
    db.execute("INSERT INTO chats VALUES (?,?,?,?,?)", cid, body.title or "New chat", body.case_id, _now(), _now())
    return db.row("SELECT * FROM chats WHERE id=?", cid)


@router.get("/chats/{chat_id}")
def get_chat(chat_id: str):
    chat = db.row("SELECT * FROM chats WHERE id=?", chat_id)
    if not chat:
        raise HTTPException(404, "unknown chat")
    msgs = db.rows("SELECT id, role, content, citations, meta, created_at FROM messages WHERE chat_id=? ORDER BY id", chat_id)
    for m in msgs:
        m["citations"] = json.loads(m["citations"] or "[]")
        m["meta"] = json.loads(m["meta"] or "{}")
    return {**chat, "messages": msgs}


@router.delete("/chats/{chat_id}")
def delete_chat(chat_id: str):
    db.execute("DELETE FROM messages WHERE chat_id=?", chat_id)
    db.execute("DELETE FROM chats WHERE id=?", chat_id)
    return {"deleted": chat_id}


class MessageIn(BaseModel):
    question: str
    case_id: str | None = None
    quick: bool = True


@router.post("/chats/{chat_id}/messages")
def send_message(chat_id: str, body: MessageIn):
    chat = db.row("SELECT * FROM chats WHERE id=?", chat_id)
    if not chat:
        raise HTTPException(404, "unknown chat")
    history = db.rows("SELECT role, content FROM messages WHERE chat_id=? ORDER BY id", chat_id)
    db.execute("INSERT INTO messages (chat_id, role, content, created_at) VALUES (?,?,?,?)", chat_id, "user", body.question, _now())
    t0 = time.time()
    learned: list[dict] = []
    finder = threading.Thread(target=lambda: learned.extend(chatmem.extract_and_store(chat_id, body.question, history)),
                              daemon=True)
    finder.start()                        # runs while the answer is being written, so it costs no extra wait
    try:
        r = agent.ask(body.question, body.case_id or chat["case_id"], body.quick, history=history)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(503, f"Memory or LLM unavailable: {type(e).__name__}: {e}")
    finder.join(timeout=20)
    meta = {"mode": r.get("mode"), "seconds": round(time.time() - t0, 1), "learned": learned}
    db.execute("INSERT INTO messages (chat_id, role, content, citations, meta, created_at) VALUES (?,?,?,?,?,?)",
               chat_id, "assistant", r["answer"], db.dumps(r["citations"]), db.dumps(meta), _now())
    title = chat["title"]
    if not history and (not title or title == "New chat"):
        title = body.question[:60] + ("…" if len(body.question) > 60 else "")
    db.execute("UPDATE chats SET title=?, updated_at=? WHERE id=?", title, _now(), chat_id)
    return {"answer": r["answer"], "citations": r["citations"], "meta": meta, "title": title}


@router.get("/chat-memories")
def list_chat_memories():
    return db.rows("""SELECT m.id, m.chat_id, m.case_id, m.text, m.kind, m.created_at, c.title AS chat_title
                      FROM chat_memories m LEFT JOIN chats c ON c.id=m.chat_id ORDER BY m.created_at DESC""")


@router.delete("/chat-memories/{mem_id}")
def forget_chat_memory(mem_id: str):
    if not chatmem.forget(mem_id):
        raise HTTPException(404, "unknown memory")
    return {"forgotten": mem_id}


# ------------------------------------------------------------------ knowledge graph
@router.get("/graph")
def knowledge_graph():
    return graph.build()


@router.get("/graph/search")
def graph_search(q: str, mode: str = "both"):
    if mode not in ("both", "keyword", "semantic"):
        raise HTTPException(400, "mode must be both, keyword or semantic")
    return graph.search(q, mode)


@router.get("/entries/{entry_id}")
def get_entry(entry_id: str):
    e = graph.entry(entry_id)
    if not e:
        raise HTTPException(404, "No such note")
    return e


@router.get("/entries/{entry_id}/file")
def get_entry_file(entry_id: str, name: str | None = None):
    p = graph.entry_file_path(entry_id, name)
    if not p:
        raise HTTPException(404, "The original file for this note isn't on this machine")
    return FileResponse(p, headers={"Cache-Control": "private, max-age=86400"})
