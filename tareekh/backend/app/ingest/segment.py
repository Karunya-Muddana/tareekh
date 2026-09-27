"""Step 2 of ingest: split extracted text into one entry per (case, hearing date) and resolve the case."""
import datetime as dt
import re

from .. import llm, registry

SYSTEM = """You file a litigator's court notes. You receive text extracted from ONE upload (a diary page, a typed
note, a case note, or a certified copy of a court order sheet) plus the lawyer's case registry.

Split the text into entries: one entry per (case, hearing date).
- A diary page or day note covering several matters -> one entry per matter.
- An order sheet with several dated rows -> one entry per dated row.
- Resolve every entry to a case_id from the registry. Lawyers use nicknames ("Tadepalli"), party surnames,
  or short numbers ("OS 318/22"). If you cannot tell, use null. Never invent a case_id.
- hearing_date: the date the hearing happened (YYYY-MM-DD). Diary pages print it at the top; order sheets use
  dd.mm.yyyy. Dates like "next date 5 Oct" are NOT the hearing date. If unknown, use null.
- text: the entry's text, copied faithfully (fix obvious OCR noise only). Do not summarise.
- author: "Meera", "Sai Kiran", "court" (for order sheets) or null.
- doc_type: one of handwritten_note, typed_note, order_sheet, other.
- confidence: 0-1, how sure you are about BOTH case_id and hearing_date.

Reply with JSON: {"entries": [{"case_id", "hearing_date", "author", "doc_type", "text", "confidence", "reason"}]}"""

_DATE_IN_NAME = [
    (re.compile(r"(20\d{2})(\d{2})(\d{2})"), lambda m: f"{m[1]}-{m[2]}-{m[3]}"),          # IMG_20260812_...
    (re.compile(r"(20\d{2})-(\d{2})-(\d{2})"), lambda m: f"{m[1]}-{m[2]}-{m[3]}"),        # court_notes_2026-08-12
]


def date_from_filename(name: str) -> str | None:
    for rx, fmt in _DATE_IN_NAME:
        m = rx.search(name or "")
        if m:
            try:
                return dt.date.fromisoformat(fmt(m)).isoformat()
            except ValueError:
                pass
    return None


def _valid_date(s) -> str | None:
    try:
        return dt.date.fromisoformat(str(s)[:10]).isoformat()
    except (ValueError, TypeError):
        return None


def _doc_type(llm_value: str | None, source_file: str) -> str:
    """The file type is ground truth for handwritten vs typed; the LLM only tells order sheets apart."""
    from .extract import kind_of
    v = llm_value or "other"
    if v == "order_sheet":
        return v
    if kind_of(source_file) == "image":
        return "handwritten_note"
    return "typed_note" if v in ("handwritten_note", "typed_note", "other") else v


def repair(entries: list[dict], source_file: str, hints: dict, known_ids: set[str]) -> list[dict]:
    """Validate the LLM's output against the registry and fill gaps from hints/filename. Pure function."""
    out = []
    fallback_date = hints.get("hearing_date") or date_from_filename(source_file)
    for e in entries:
        text = (e.get("text") or "").strip()
        if not text:
            continue
        conf = float(e.get("confidence") or 0.5)
        reasons = [e.get("reason") or ""]
        cid = e.get("case_id")
        if cid not in known_ids:
            cid = None
        if not cid and hints.get("case_id") in known_ids:
            cid, conf = hints["case_id"], max(conf, 0.9)
            reasons.append("case from upload hint")
        if not cid:
            found = registry.find_cases(text[:300], limit=1)
            if found:
                cid = found[0]["case_id"]
                conf = min(conf, found[0]["score"] / 100)
                reasons.append(f"case by alias '{found[0]['matched']}'")
        date = _valid_date(e.get("hearing_date"))
        if not date and fallback_date:
            date = fallback_date
            conf = min(conf, 0.75)
            reasons.append("date from filename/hint")
        if not cid or not date:
            conf = min(conf, 0.3)
        out.append({
            "case_id": cid, "hearing_date": date, "author": e.get("author") or hints.get("author"),
            "doc_type": _doc_type(e.get("doc_type"), source_file), "text": text, "confidence": round(conf, 2),
            "reason": "; ".join(r for r in reasons if r),
        })
    return out


def segment(raw_text: str, source_file: str, hints: dict) -> list[dict]:
    known = {c["id"] for c in registry.db.rows("SELECT id FROM cases")}
    user = (f"UPLOAD FILE NAME: {source_file}\nUSER HINTS: {hints}\n\nCASE REGISTRY (id | number | nickname | parties | judge):\n"
            f"{registry.compact_listing()}\n\nEXTRACTED TEXT:\n{raw_text}")
    result = llm.chat_json(SYSTEM, user)
    return repair(result.get("entries", []), source_file, hints, known)
