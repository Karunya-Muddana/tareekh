"""Tests that need no API keys: registry resolution, extraction, segment repair, item building."""
import json
import os
import tempfile
from pathlib import Path

import pytest

os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="tareekh-test-")

from app import db, memory, registry  # noqa: E402
from app.ingest import extract, segment  # noqa: E402

WORLD = Path(__file__).resolve().parents[3] / "tareekh-data" / "data" / "world.json"
BACKLOG = Path(__file__).resolve().parents[3] / "tareekh-data" / "uploads" / "backlog"


@pytest.fixture(scope="module", autouse=True)
def loaded():
    db.init()
    return registry.load_registry(json.loads(WORLD.read_text(encoding="utf-8")))


def test_onboarding_strips_learned_fields(loaded):
    assert loaded["cases"] == 5
    assert registry.practice()["lawyer_short"] == "Aditya" and registry.practice()["assistant_short"] == "Divya"
    cols = {r["name"] for r in db.rows("PRAGMA table_info(judges)")}
    assert not cols & {"habits", "temperament"}


@pytest.mark.parametrize("text,expected", [
    ("OS 214/24 - Harinath sought time", "C1"),
    ("O.S. No. 57 of 2025", "C2"),
    ("Seabreeze injunction - DW1 cross", "C3"),
    ("Gorle partition - mediation failed", "C1"),
    ("Tiffin centre - instalment not paid", "C4"),
    ("Greenfield - Bhaskar unwell again", "C5"),
    ("Seabreeze SP suit - IA 1187 amendment", "C2"),
])
def test_find_case(text, expected):
    hits = registry.find_cases(text)
    assert hits and hits[0]["case_id"] == expected, hits


def test_case_keys():
    assert registry.case_keys_in("see O.S.No.131/2025 and OS 214 of 2024") == ["OS-131-25", "OS-214-24"]


def test_date_from_filename():
    assert segment.date_from_filename("IMG_20260812_171906.jpg") == "2026-08-12"
    assert segment.date_from_filename("court_notes_2026-09-04.txt") == "2026-09-04"
    assert segment.date_from_filename("notes.txt") is None


def test_repair_fills_and_validates():
    known = {"C5", "C3"}
    out = segment.repair([
        {"case_id": "C99", "hearing_date": None, "text": "Greenfield school - not reached", "confidence": 0.9},
        {"case_id": "C3", "hearing_date": "2026-09-04", "text": "DW1 cross", "confidence": 0.95},
        {"case_id": None, "hearing_date": None, "text": "   "},
    ], "IMG_20260916_101010.jpg", {}, known)
    assert len(out) == 2
    assert out[0]["case_id"] == "C5" and out[0]["hearing_date"] == "2026-09-16" and out[0]["confidence"] <= 0.75
    assert out[1]["confidence"] == 0.95


def test_extract_text_and_docx():
    txt = next(BACKLOG.rglob("court_notes_2025-05-21.txt"))
    text, method = extract.extract(txt)
    assert method == "text" and "construction activity whatsoever" in text
    docx = next(BACKLOG.rglob("*.docx"))
    text, method = extract.extract(docx)
    assert method == "docx" and len(text) > 20


def test_build_item_shape():
    item = memory.build_item({"case_id": "C3", "hearing_date": "2025-06-04", "text": "Rejoinder filed, diary no. 2291",
                              "author": "Aditya", "doc_type": "typed_note"}, "up1", "court_notes_2025-06-04.txt")
    assert item["timestamp"].startswith("2025-06-04")
    assert {"case:C3", "judge:J1", "counsel:OC2", "client:CL1"} <= set(item["tags"])
    assert item["metadata"]["source_file"] == "court_notes_2025-06-04.txt"
    assert ["judge:J1"] in item["observation_scopes"]
    assert "O.S. No. 131 of 2025" in item["content"]


def test_company_name_matches_both_seabreeze_cases():
    ids = {h["case_id"] for h in registry.find_cases("What did Seabreeze Resorts say about the poles?")}
    assert {"C2", "C3"} <= ids


def test_doc_type_follows_file_kind():
    out = segment.repair([{"case_id": "C3", "hearing_date": "2026-09-04", "text": "x", "doc_type": "handwritten_note"}],
                         "court_notes_2026-09-04.txt", {}, {"C3"})
    assert out[0]["doc_type"] == "typed_note"
    out = segment.repair([{"case_id": "C3", "hearing_date": "2026-08-12", "text": "x", "doc_type": "order_sheet"}],
                         "CC_OS_131-2025.jpg", {}, {"C3"})
    assert out[0]["doc_type"] == "order_sheet"


def test_grouped_citations():
    from app.agent.agent import FactBook
    b = FactBook()
    for i in range(20):
        b.add({"id": str(i), "text": f"f{i}", "metadata": {}})
    assert [c["n"] for c in b.citations("a [1, 17] b [3] c [99]")] == [1, 3, 17]


# ------------------------------------------------------------------ knowledge graph
def _seed_entries():
    import uuid
    up = uuid.uuid4().hex[:8]
    db.execute("INSERT INTO uploads (id, created_at, status, hints, files) VALUES (?,?,?,?,?)", up, "2026-01-01", "done", "{}",
               json.dumps([{"name": "note.txt", "path": "/nonexistent/note.txt", "kind": "text"}]))
    rows = [("C3", "2026-08-19", "DW1 admitted survey pegs and some poles were put in April 2025. Confront with plaint para 3."),
            ("C3", "2026-09-02", "Photos dated 14.04.2025 show fencing poles, not survey pegs."),
            ("C5", "2026-09-14", "Greenfield: third adjournment request rejected by Murthy sir, costs imposed.")]
    ids = []
    for cid, date, text in rows:
        eid = uuid.uuid4().hex[:8]
        ids.append(eid)
        db.execute("INSERT INTO entries (id, upload_id, source_file, case_id, hearing_date, author, doc_type, text, status) "
                   "VALUES (?,?,?,?,?,?,?,?,?)", eid, up, "note.txt", cid, date, "Aditya", "handwritten_note", text, "retained")
    return ids


def test_graph_links_entries_to_cases_and_each_other(loaded):
    from app import graph
    ids = _seed_entries()
    g = graph.build()
    kinds = {l["type"] for l in g["links"]}
    assert {"case", "entity", "temporal"} <= kinds
    assert any(l["source"] == f"e:{ids[0]}" and l["target"] == "c:C3" for l in g["links"])


def test_graph_search_is_fuzzy_and_drops_irrelevant(loaded, monkeypatch):
    from app import graph
    monkeypatch.setattr(graph.memory, "recall", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("offline")))
    r = graph.search("survey pgs", mode="keyword")      # typo still matches
    texts = [graph._node_text(x["id"], graph._index()) for x in r["results"]]
    assert texts and all("survey" in t.lower() for t in texts)
    assert not any("Greenfield" in t for t in texts)


def test_entry_file_never_serves_unregistered_paths(loaded):
    from app import graph
    ids = _seed_entries()
    assert graph.entry_file_path(ids[0], "../../etc/passwd") is None
    assert graph.entry_file_path(ids[0], None) is None   # registered but missing on disk


def test_nearest_pairs_matches_brute_force(loaded):
    from app import graph
    docs = {f"d{i}": graph._tokens(t) for i, t in enumerate([
        "survey pegs and poles on the land", "fencing poles not survey pegs", "costs for third adjournment",
        "adjournment rejected costs imposed", "rent instalment not paid", "tenant deposit of rent"])}
    vecs, _ = graph._tfidf(docs)
    fast = {(a, b) for a, b, _ in graph._nearest_pairs(vecs, k=2)}
    for a in vecs:
        brute = sorted(((graph._cos(vecs[a], vecs[b]), b) for b in vecs if b != a), reverse=True)[:2]
        for s, b in brute:
            if s > 0:
                assert (a, b) in fast


def test_graph_cache_invalidates_without_count_change(loaded):
    from app import graph
    ids = _seed_entries()
    before = graph.build()
    db.execute("UPDATE entries SET case_id='C5' WHERE id=?", ids[0])   # a fix in review: same counts
    assert graph.build() is before                                     # counts alone can't see it...
    graph.invalidate()
    after = graph.build()
    assert after is not before
    assert any(l["source"] == f"e:{ids[0]}" and l["target"] == "c:C5" for l in after["links"])


def test_entry_file_urls_are_encoded(loaded):
    from app import graph
    import uuid
    up = uuid.uuid4().hex[:8]
    db.execute("INSERT INTO uploads (id, created_at, status, hints, files) VALUES (?,?,?,?,?)", up, "2026-01-01", "done", "{}",
               json.dumps([{"name": "IMG 1&2 #a.jpg", "path": "/x/IMG 1&2 #a.jpg", "kind": "image"}]))
    eid = uuid.uuid4().hex[:8]
    db.execute("INSERT INTO entries (id, upload_id, source_file, case_id, hearing_date, author, doc_type, text, status) "
               "VALUES (?,?,?,?,?,?,?,?,?)", eid, up, "IMG 1&2 #a.jpg", "C1", "2026-01-02", "Aditya", "handwritten_note", "x", "retained")
    assert graph.entry(eid)["files"][0]["url"].endswith("?name=IMG%201%262%20%23a.jpg")


def _chat_with(n_pairs: int, words: int = 40) -> str:
    cid = f"t{n_pairs}{words}"
    db.execute("INSERT INTO chats VALUES (?,?,?,?,?)", cid, "test", None, "2026-10-05", "2026-10-05")
    for i in range(n_pairs):
        db.execute("INSERT INTO messages (chat_id, role, content, created_at) VALUES (?,?,?,?)", cid, "user", f"question {i}", "x")
        db.execute("INSERT INTO messages (chat_id, role, content, created_at) VALUES (?,?,?,?)", cid, "assistant",
                   f"answer {i} [1, 2] " + "hearing " * words, "x")
    return cid


def test_thread_is_carried_whole_without_old_citation_numbers(loaded):
    from app import threadctx
    cid = _chat_with(5)
    summary, msgs = threadctx.carried(cid)
    assert summary is None and len(msgs) == 10
    assert "[1, 2]" not in msgs[1]["content"]          # old [n] markers would point at the wrong facts
    st = threadctx.state(cid)
    assert st["used"] == st["recent_tokens"] > 0 and not st["compressing"]


def test_compression_keeps_recent_turns_and_replaces_older_ones(loaded, monkeypatch):
    from types import SimpleNamespace
    from app import llm, threadctx
    cid = _chat_with(6, words=300)
    monkeypatch.setattr(threadctx, "budget", lambda: 1000)   # well over 80% of this
    seen = {}

    def fake_chat(messages, **_):
        seen["prompt"] = messages[-1]["content"]
        return SimpleNamespace(content="- Asked about questions 0-3; answers covered the hearings.")
    monkeypatch.setattr(llm, "chat", fake_chat)

    assert threadctx.compress_later(cid)
    threadctx.wait(cid)                                 # returns once the background compression is done
    summary, msgs = threadctx.carried(cid)
    assert summary.startswith("- Asked about")
    assert [m["content"] for m in msgs if m["role"] == "user"] == ["question 4", "question 5"]
    assert "question 3" in seen["prompt"] and "question 4" not in seen["prompt"]
    st = threadctx.state(cid)
    assert st["summarized_messages"] == 8 and st["recent_messages"] == 4 and not st["compressing"]
    assert not threadctx.compress(cid)                  # nothing older than the kept turns is left to fold in


def test_empty_summary_keeps_the_full_thread(loaded, monkeypatch):
    from types import SimpleNamespace
    from app import llm, threadctx
    cid = _chat_with(4, words=300)
    monkeypatch.setattr(llm, "chat", lambda *a, **k: SimpleNamespace(content=""))
    assert not threadctx.compress(cid, force=True)
    assert threadctx.carried(cid)[0] is None and len(threadctx.carried(cid)[1]) == 8
