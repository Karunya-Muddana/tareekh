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
