"""Chat memories: durable things the lawyer says in a chat ("this is the plan we stick to") become memories.

They rank below court records and notes, are labelled as chat memories wherever they are shown or cited, and the
lawyer can make Tareekh forget one.
"""
import datetime as dt
import logging
import uuid
from urllib.parse import quote

import httpx

from . import db, llm, memory, registry
from .config import settings, today_iso

log = logging.getLogger("tareekh.chatmem")

SYSTEM = """You watch a litigator's chat with his practice-memory assistant and pick out what is worth remembering
long-term. Keep ONLY durable statements the lawyer himself makes: decisions, plans, strategies he says he will stick
to, instructions for how he wants things done, facts he asserts that are not already obvious from the question,
preferences, deadlines he sets. Ignore questions, greetings, thanks, and anything the assistant said.

Each memory: one self-contained sentence in the third person ("{lawyer} decided ...", "{lawyer} wants ..."), with
names, dates and amounts kept exactly. Attach case_id from the registry if it is clearly about one case, else null.
kind: decision | plan | instruction | fact | preference | deadline.

Most messages contain nothing worth keeping. Then return {{"memories": []}}.
Reply with JSON: {{"memories": [{{"text", "case_id", "kind"}}]}}"""


def extract_and_store(chat_id: str, message: str, recent: list[dict]) -> list[dict]:
    """Run after a user message. Returns the memories stored (usually none)."""
    p = registry.practice()
    known = {c["id"] for c in db.rows("SELECT id FROM cases")}
    context = "\n".join(f"{m['role']}: {m['content'][:400]}" for m in recent[-4:])
    user = (f"CASE REGISTRY:\n{registry.compact_listing()}\n\nRECENT CHAT:\n{context}\n\n"
            f"LAWYER'S NEW MESSAGE:\n{message}")
    try:
        out = llm.chat_json(SYSTEM.format(lawyer=p["lawyer_short"]), user).get("memories") or []
    except Exception as e:  # noqa: BLE001 - never break a chat over this
        log.warning("chat memory extraction failed: %s", e)
        return []
    chat = db.row("SELECT title FROM chats WHERE id=?", chat_id) or {"title": "chat"}
    stored = []
    for m in out:
        text = (m.get("text") or "").strip()
        if len(text) < 12:
            continue
        cid = m.get("case_id") if m.get("case_id") in known else None
        mid = uuid.uuid4().hex[:10]
        doc_id = f"chat:{chat_id}:{mid}"
        today = today_iso()
        tags = (registry.case_tags(cid) if cid else []) + ["type:chat_memory", f"author:{p['lawyer_short'].lower()}"]
        item = {
            "content": f"[{today}] CHAT MEMORY (said by {p['lawyer']} in a chat with Tareekh, not a court record): {text}",
            "context": "chat memory",
            "timestamp": f"{today}T{dt.datetime.now().strftime('%H:%M:%S')}+05:30",
            "tags": tags,
            "metadata": {"source_file": f"chat: {chat['title']}", "doc_type": "chat_memory", "case_id": cid or "",
                         "hearing_date": today, "author": p["lawyer_short"], "chat_id": chat_id},
            "document_id": doc_id,
        }
        try:
            memory.retain_items([item])
        except Exception as e:  # noqa: BLE001
            log.warning("chat memory retain failed: %s", e)
            continue
        db.execute("INSERT INTO chat_memories VALUES (?,?,?,?,?,?,?)", mid, chat_id, cid, text,
                   m.get("kind") or "fact", doc_id, dt.datetime.now().isoformat(timespec="seconds"))
        stored.append({"id": mid, "case_id": cid, "text": text, "kind": m.get("kind")})
    return stored


def forget(mem_id: str) -> bool:
    row = db.row("SELECT document_id FROM chat_memories WHERE id=?", mem_id)
    if not row:
        return False
    try:   # remove it from Hindsight too, so it can't come back in an answer
        httpx.delete(f"{settings.hindsight_url}/v1/default/banks/{settings.bank_id}/documents/{quote(row['document_id'], safe='')}",
                     timeout=20).raise_for_status()
    except Exception as e:  # noqa: BLE001
        log.warning("could not delete chat memory %s from Hindsight: %s", mem_id, e)
    db.execute("DELETE FROM chat_memories WHERE id=?", mem_id)
    return True
