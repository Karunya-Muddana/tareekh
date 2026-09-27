import json

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from .. import bank_setup, db, memory, registry
from ..agent import agent
from ..ingest import pipeline

router = APIRouter()


# ------------------------------------------------------------------ onboarding
class OnboardIn(BaseModel):
    world: dict                        # same shape as tareekh-data/data/world.json
    configure_memory: bool = True      # False = registry only (no Hindsight calls), handy offline
    retain_stubs: bool = False         # one memory per case; costly on free-tier LLM quotas, and hearing memories
                                       # already carry case/judge/counsel names in their header


@router.post("/onboard")
def onboard(body: OnboardIn):
    out = {"registry": registry.load_registry(body.world)}
    if body.configure_memory:
        out["bank"] = bank_setup.configure_bank()
        out["mental_models"] = bank_setup.create_mental_models()
        if body.retain_stubs:
            out["stubs"] = bank_setup.retain_case_stubs()
    return out


# ------------------------------------------------------------------ registry
@router.get("/cases")
def list_cases():
    return db.rows("SELECT id, case_number, short_name, title, judge_id, opposing_counsel_id, client_id, stage FROM cases ORDER BY id")


@router.get("/cases/{case_id}")
def get_case(case_id: str):
    c = registry.case_context(case_id)
    if not c:
        raise HTTPException(404, "unknown case")
    return c


@router.get("/cases/resolve/{text}")
def resolve(text: str):
    return registry.find_cases(text)


# ------------------------------------------------------------------ uploads
@router.post("/uploads")
async def upload(background: BackgroundTasks,
                 files: list[UploadFile] = File(default=[]),
                 text: str | None = Form(default=None),
                 case_id: str | None = Form(default=None),
                 hearing_date: str | None = Form(default=None),
                 author: str | None = Form(default=None),
                 auto_confirm: bool = Form(default=False)):
    payload = [(f.filename, await f.read()) for f in files if f.filename]
    hints = {k: v for k, v in {"case_id": case_id, "hearing_date": hearing_date, "author": author,
                               "auto_confirm": auto_confirm}.items() if v not in (None, "")}
    try:
        upload_id = pipeline.create_upload(payload, text, hints)
    except ValueError as e:
        raise HTTPException(400, str(e))
    background.add_task(pipeline.process_upload, upload_id)
    return {"upload_id": upload_id, "status": "queued"}


@router.get("/uploads/{upload_id}")
def get_upload(upload_id: str):
    up = db.row("SELECT id, created_at, status, error, hints, files FROM uploads WHERE id=?", upload_id)
    if not up:
        raise HTTPException(404, "unknown upload")
    up["hints"], up["files"] = json.loads(up["hints"] or "{}"), [f["name"] for f in json.loads(up["files"])]
    up["entries"] = db.rows("SELECT id, source_file, case_id, hearing_date, author, doc_type, text, confidence, reason, status "
                            "FROM entries WHERE upload_id=? ORDER BY source_file, hearing_date", upload_id)
    return up


class ConfirmIn(BaseModel):
    edits: list[dict] = []             # [{id, case_id?, hearing_date?, text?, author?, reject?}]


@router.post("/uploads/{upload_id}/confirm")
def confirm(upload_id: str, body: ConfirmIn):
    if not db.row("SELECT id FROM uploads WHERE id=?", upload_id):
        raise HTTPException(404, "unknown upload")
    try:
        return pipeline.confirm(upload_id, body.edits)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Could not store in memory: {type(e).__name__}: {e}")


@router.get("/memory/status")
def memory_status():
    """Is Hindsight still digesting? pending_operations > 0 means answers may not include the latest uploads yet."""
    try:
        s = memory.status()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(503, f"Hindsight unavailable: {e}")
    keys = ("pending_operations", "failed_operations", "pending_consolidation", "total_observations",
            "total_nodes", "total_documents", "last_consolidated_at", "last_memory_write_at")
    return {k: s.get(k) for k in keys}


# ------------------------------------------------------------------ ask
class AskIn(BaseModel):
    question: str
    case_id: str | None = None         # the matter currently open in the UI (e.g. the one being called in court)
    quick: bool = False                # in-court mode: single recall, no tool loop


@router.post("/ask")
def ask(body: AskIn):
    try:
        return agent.ask(body.question, body.case_id, body.quick)
    except Exception as e:  # noqa: BLE001 - even the fallback failed (e.g. no API keys / service down)
        raise HTTPException(503, f"Memory or LLM unavailable: {type(e).__name__}: {e}")
