"""Fill a local database from the demo backlog without any API keys: registry from world.json, and one entry per
backlog upload using its ground-truth text (no OCR, no LLM, nothing sent to Hindsight). For UI work on the
Today screen, the knowledge graph and note previews when memory and the model aren't available.

    python scripts/seed_local.py          # into DATA_DIR (default backend/var)
"""
import json
import shutil
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db, registry  # noqa: E402
from app.config import settings  # noqa: E402
from app.ingest import extract  # noqa: E402

DATA = Path(__file__).resolve().parents[3] / "tareekh-data"
DOC_TYPE = {"certified_order_sheet_scan": "order_sheet", "document_scan": "document", "document_photo": "document",
            "handwritten_letter_photo": "document", "whatsapp_export": "document", "typed_note_txt": "typed_note",
            "typed_note_docx": "typed_note"}


def main():
    db.init()
    registry.load_registry(json.loads((DATA / "data" / "world.json").read_text(encoding="utf-8")))
    authors = {"Aditya": registry.practice()["lawyer_short"], "Divya": registry.practice()["assistant_short"]}
    manifest = json.loads((DATA / "uploads" / "manifest.json").read_text(encoding="utf-8"))
    made = 0
    for m in manifest:
        if db.row("SELECT 1 FROM uploads WHERE hints=?", json.dumps({"seed": m["files"][0]})):
            continue
        upload_id = uuid.uuid4().hex[:12]
        folder = settings.upload_dir / upload_id
        folder.mkdir(parents=True, exist_ok=True)
        files = []
        for f in m["files"]:
            src = DATA / "uploads" / f
            shutil.copy2(src, folder / src.name)
            files.append({"name": src.name, "path": str(folder / src.name), "kind": extract.kind_of(src.name)})
        db.execute("INSERT INTO uploads (id, created_at, status, hints, files) VALUES (?,?,?,?,?)",
                   upload_id, m["date"], "done", json.dumps({"seed": m["files"][0]}), json.dumps(files))
        for cid in m["case_ids"]:
            db.execute("""INSERT INTO entries (id, upload_id, source_file, case_id, hearing_date, author, doc_type, text,
                          confidence, reason, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                       uuid.uuid4().hex[:12], upload_id, files[0]["name"], cid, m["date"],
                       authors.get(m["author"], "court" if m["author"] == "court" else None),
                       DOC_TYPE.get(m["type"], "handwritten_note"), m["source_text"], 1.0, "seeded", "retained")
        made += 1
    print(f"seeded {made} uploads into {settings.db_path}")


if __name__ == "__main__":
    main()
