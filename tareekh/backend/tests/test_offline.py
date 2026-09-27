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
START = Path(__file__).resolve().parents[3] / "tareekh-data" / "uploads" / "START_HERE"


@pytest.fixture(scope="module", autouse=True)
def loaded():
    db.init()
    return registry.load_registry(json.loads(WORLD.read_text(encoding="utf-8")))


def test_onboarding_strips_learned_fields(loaded):
    assert loaded["cases"] == 40
    cols = {r["name"] for r in db.rows("PRAGMA table_info(judges)")}
    assert not cols & {"habits", "temperament"}


@pytest.mark.parametrize("text,expected", [
    ("OS 318/22 Tadepalli - Achary sought time", "C07"),
    ("O.S. No. 318 of 2022", "C07"),
    ("Tadepalli matter adjourned", "C07"),
    ("Gudivada v Kasoju - PW1 chief today", "C31"),
    ("Sai Balaji GHMC WP (WP 14872/25). R3 counter", "C23"),
    ("Lakshmi Ganapathi - Achary unwell", "C12"),
    ("Kamala Devi wall - Jadhav", "C19"),
    ("Sunitha injunction - IA 402 dismissed", "C35"),
])
def test_find_case(text, expected):
    hits = registry.find_cases(text)
    assert hits and hits[0]["case_id"] == expected, hits


def test_case_keys():
    assert registry.case_keys_in("see W.P.No.14872/2025 and OS 318 of 2022") == ["WP-14872-25", "OS-318-22"]


def test_date_from_filename():
    assert segment.date_from_filename("IMG_20260812_171906.jpg") == "2026-08-12"
    assert segment.date_from_filename("court_notes_2026-09-04.txt") == "2026-09-04"
    assert segment.date_from_filename("notes.txt") is None


def test_repair_fills_and_validates():
    known = {"C07", "C23"}
    out = segment.repair([
        {"case_id": "C99", "hearing_date": None, "text": "Tadepalli - not reached", "confidence": 0.9},
        {"case_id": "C23", "hearing_date": "2026-09-04", "text": "reply filed", "confidence": 0.95},
        {"case_id": None, "hearing_date": None, "text": "   "},
    ], "IMG_20260916_101010.jpg", {}, known)
    assert len(out) == 2
    assert out[0]["case_id"] == "C07" and out[0]["hearing_date"] == "2026-09-16" and out[0]["confidence"] <= 0.75
    assert out[1]["confidence"] == 0.95


def test_extract_text_and_docx():
    txt = next((START / "level1_one_case").glob("*.txt"))
    text, method = extract.extract(txt)
    assert method == "text" and "4471" in text
    docx = next((Path(__file__).resolve().parents[3] / "tareekh-data" / "uploads" / "backlog").rglob("*.docx"))
    text, method = extract.extract(docx)
    assert method == "docx" and len(text) > 20


def test_build_item_shape():
    item = memory.build_item({"case_id": "C23", "hearing_date": "2026-09-04", "text": "Reply filed, diary no. 4471",
                              "author": "Meera", "doc_type": "typed_note"}, "up1", "court_notes_2026-09-04.txt")
    assert item["timestamp"].startswith("2026-09-04")
    assert {"case:C23", "judge:J3", "counsel:OC2", "client:CL4"} <= set(item["tags"])
    assert item["metadata"]["source_file"] == "court_notes_2026-09-04.txt"
    assert ["judge:J3"] in item["observation_scopes"]
    assert "W.P. No. 14872 of 2025" in item["content"]


def test_two_word_alias_matches_both_sai_balaji_cases():
    ids = {h["case_id"] for h in registry.find_cases("Did I file the reply in the Sai Balaji case?")}
    assert "C23" in ids


def test_doc_type_follows_file_kind():
    out = segment.repair([{"case_id": "C23", "hearing_date": "2026-09-04", "text": "x", "doc_type": "handwritten_note"}],
                         "court_notes_2026-09-04.txt", {}, {"C23"})
    assert out[0]["doc_type"] == "typed_note"
    out = segment.repair([{"case_id": "C23", "hearing_date": "2026-08-12", "text": "x", "doc_type": "order_sheet"}],
                         "CC_WP_14872-25.jpg", {}, {"C23"})
    assert out[0]["doc_type"] == "order_sheet"


def test_grouped_citations():
    from app.agent.agent import FactBook
    b = FactBook()
    for i in range(20):
        b.add({"id": str(i), "text": f"f{i}", "metadata": {}})
    assert [c["n"] for c in b.citations("a [1, 17] b [3] c [99]")] == [1, 3, 17]
