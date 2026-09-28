"""Upload lifecycle: queued → extracting → segmenting → review → retaining → done (or error)."""
import datetime as dt
import json
import logging
import uuid
from pathlib import Path

from .. import db, graph, memory
from ..config import settings
from . import extract, segment

log = logging.getLogger("tareekh.ingest")


def _status(upload_id, status, error=None):
    db.execute("UPDATE uploads SET status=?, error=? WHERE id=?", status, error, upload_id)


def create_upload(files: list[tuple[str, bytes]], text: str | None, hints: dict) -> str:
    """Save files to disk and register the upload. Pasted text is stored as a .txt file so every path is the same."""
    upload_id = uuid.uuid4().hex[:12]
    folder = settings.upload_dir / upload_id
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    for name, data in files:
        safe = Path(name).name or "upload"
        (folder / safe).write_bytes(data)
        saved.append({"name": safe, "path": str(folder / safe), "kind": extract.kind_of(safe)})
    if text and text.strip():
        name = f"typed_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        (folder / name).write_text(text, encoding="utf-8")
        saved.append({"name": name, "path": str(folder / name), "kind": "text"})
    if not saved:
        raise ValueError("Nothing to upload: send files or text.")
    db.execute("INSERT INTO uploads (id, created_at, status, hints, files) VALUES (?,?,?,?,?)",
               upload_id, dt.datetime.now().isoformat(timespec="seconds"), "queued", db.dumps(hints), db.dumps(saved))
    return upload_id


def process_upload(upload_id: str):
    """Background job. Extract + segment every file, then auto-retain if allowed and confident."""
    up = db.row("SELECT * FROM uploads WHERE id=?", upload_id)
    hints = json.loads(up["hints"] or "{}")
    try:
        raw_parts = []
        for f in json.loads(up["files"]):
            _status(upload_id, "extracting")
            text, method = extract.extract(Path(f["path"]))
            raw_parts.append(f"--- {f['name']} ({method}) ---\n{text}")
            _status(upload_id, "segmenting")
            for e in segment.segment(text, f["name"], hints):
                db.execute("INSERT INTO entries VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                           uuid.uuid4().hex[:12], upload_id, f["name"], e["case_id"], e["hearing_date"], e["author"],
                           e["doc_type"], e["text"], e["confidence"], e["reason"], "review")
        db.execute("UPDATE uploads SET raw_text=? WHERE id=?", "\n\n".join(raw_parts), upload_id)
        entries = db.rows("SELECT * FROM entries WHERE upload_id=?", upload_id)
        confident = entries and all(e["case_id"] and e["hearing_date"] and e["confidence"] >= settings.auto_confirm_threshold
                                    for e in entries)
        if hints.get("auto_confirm") and confident:
            confirm(upload_id, [])
        else:
            _status(upload_id, "review")
    except Exception as e:  # noqa: BLE001 - surface every failure to the UI
        log.exception("upload %s failed", upload_id)
        _status(upload_id, "error", f"{type(e).__name__}: {e}")


def confirm(upload_id: str, edits: list[dict]) -> dict:
    """Apply user edits ({id, case_id?, hearing_date?, text?, reject?}), then retain every confirmable entry."""
    for ed in edits:
        if ed.get("reject"):
            db.execute("UPDATE entries SET status='rejected' WHERE id=? AND upload_id=?", ed["id"], upload_id)
            continue
        for field in ("case_id", "hearing_date", "text", "author"):
            if ed.get(field):
                db.execute(f"UPDATE entries SET {field}=? WHERE id=? AND upload_id=?", ed[field], ed["id"], upload_id)
    todo = db.rows("SELECT * FROM entries WHERE upload_id=? AND status IN ('review','confirmed','failed')", upload_id)
    ready = [e for e in todo if e["case_id"] and e["hearing_date"]]
    if not ready:
        _status(upload_id, "review", "No entry has both a case and a date yet.")
        return {"retained": 0, "skipped": len(todo)}
    _status(upload_id, "retaining")
    # a multi-page document gives one entry per page for the same case and date; store them as one memory
    # (Hindsight rejects two items with the same document_id in one batch)
    merged: dict[tuple, dict] = {}
    for e in ready:
        key = (e["case_id"], e["hearing_date"])
        if key in merged:
            merged[key] = {**merged[key], "text": merged[key]["text"] + "\n" + e["text"]}
        else:
            merged[key] = dict(e)
    items = [memory.build_item(e, upload_id, e["source_file"]) for e in merged.values()]
    try:
        memory.retain_items(items)
    except Exception as e:  # noqa: BLE001
        for x in ready:
            db.execute("UPDATE entries SET status='failed' WHERE id=?", x["id"])
        _status(upload_id, "error", f"retain failed: {e}")
        raise
    for x in ready:
        db.execute("UPDATE entries SET status='retained' WHERE id=?", x["id"])
    graph.invalidate()
    left = len(todo) - len(ready)
    _status(upload_id, "done" if not left else "review", None if not left else f"{left} entries still need a case or date")
    return {"retained": len(ready), "skipped": left}
