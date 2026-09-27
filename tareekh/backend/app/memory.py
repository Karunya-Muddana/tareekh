"""Everything that talks to Hindsight lives here."""
import logging
import threading

from hindsight_client import Hindsight

from . import registry
from .config import settings

log = logging.getLogger("tareekh.memory")
_local = threading.local()


def client() -> Hindsight:
    """One client per thread: the client wraps an async session that breaks if two threads share it
    ("Timeout context manager should be used inside a task")."""
    if getattr(_local, "client", None) is None:
        kw = {"base_url": settings.hindsight_url}
        if settings.hindsight_api_key:
            kw["api_key"] = settings.hindsight_api_key
        _local.client = Hindsight(**kw)
    return _local.client


def _get(obj, key, default=None):
    """Client responses are sometimes pydantic models, sometimes dicts."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


# ------------------------------------------------------------------ retain
def build_item(entry: dict, upload_id: str, source_file: str) -> dict:
    """One Hindsight item per hearing entry. See ARCHITECTURE.md section 1."""
    cid, date = entry["case_id"], entry["hearing_date"]
    c = registry.case_context(cid)
    author = entry.get("author") or "unknown"
    header = (f"[{date}] {c['case_number']} ({c['short_name']}; {c['title']}) before {c['judge_name']}; "
              f"opposing counsel {c['counsel_name']}; client {c['client_name']}. "
              f"Source: {entry.get('doc_type', 'note').replace('_', ' ')} by {author}.")
    return {
        "content": header + "\n" + entry["text"],
        "context": {"order_sheet": "court order sheet", "document": "case document"}.get(entry.get("doc_type"), "lawyer's hearing note"),
        "timestamp": f"{date}T10:30:00+05:30",
        "tags": registry.case_tags(cid) + [f"type:{entry.get('doc_type', 'other')}", f"author:{author.lower().replace(' ', '_')}"],
        "metadata": {"source_file": source_file, "upload_id": upload_id, "doc_type": entry.get("doc_type", "other"),
                     "case_id": cid, "hearing_date": date, "author": author},
        "document_id": f"{upload_id}:{cid}:{date}",
        # Consolidate observations per judge, per counsel and per case, so cross-case patterns can form.
        "observation_scopes": [[f"judge:{c['judge_id']}"], [f"counsel:{c['opposing_counsel_id']}"], [f"case:{cid}"]],
    }


def retain_items(items: list[dict]):
    """Always async: Hindsight queues the work and retries on provider rate limits (a sync retain would just fail)."""
    return client().retain_batch(bank_id=settings.bank_id, items=items, retain_async=True)


def status() -> dict:
    """Bank stats incl. pending_operations / pending_consolidation / total_observations."""
    import httpx
    headers = {"Authorization": f"Bearer {settings.hindsight_api_key}"} if settings.hindsight_api_key else {}
    r = httpx.get(f"{settings.hindsight_url}/v1/default/banks/{settings.bank_id}/stats", headers=headers, timeout=15)
    r.raise_for_status()
    return r.json()


# ------------------------------------------------------------------ recall / reflect
def _tags(case_id=None, judge_id=None, counsel_id=None) -> list[str] | None:
    t = []
    if case_id:
        t.append(f"case:{case_id}")
    if judge_id:
        t.append(f"judge:{judge_id}")
    if counsel_id:
        t.append(f"counsel:{counsel_id}")
    return t or None


def recall(query: str, case_id=None, judge_id=None, counsel_id=None, max_tokens=2500, budget="mid") -> list[dict]:
    """Returns plain dicts: text, type, date, tags, metadata."""
    resp = client().recall(bank_id=settings.bank_id, query=query, max_tokens=max_tokens, budget=budget,
                           tags=_tags(case_id, judge_id, counsel_id), tags_match="any")
    out = []
    for r in _get(resp, "results", []) or []:
        out.append({
            "id": _get(r, "id"), "text": _get(r, "text"), "type": _get(r, "type"),
            "occurred": _get(r, "occurred_start"), "tags": _get(r, "tags") or [],
            "metadata": _get(r, "metadata") or {}, "document_id": _get(r, "document_id"),
        })
    return out


def reflect(query: str, case_id=None, judge_id=None, counsel_id=None, context=None, budget="mid") -> dict:
    resp = client().reflect(bank_id=settings.bank_id, query=query, budget=budget, context=context,
                            tags=_tags(case_id, judge_id, counsel_id), tags_match="any", include_facts=True)
    based = _get(resp, "based_on") or {}
    mems = [{"id": _get(m, "id"), "text": _get(m, "text"), "type": _get(m, "type"), "occurred": _get(m, "occurred_start")}
            for m in (_get(based, "memories") or [])]
    return {"text": _get(resp, "text", ""), "memories": mems}


# ------------------------------------------------------------------ mental models
def mental_model_id(kind: str, ref: str) -> str:
    return f"{kind}-{ref}".lower()


def get_mental_model_text(mm_id: str) -> str | None:
    try:
        mm = client().get_mental_model(bank_id=settings.bank_id, mental_model_id=mm_id, detail="content")
        return _get(mm, "content") or None
    except Exception as e:  # noqa: BLE001 - a missing model must never break an answer
        log.info("mental model %s unavailable: %s", mm_id, e)
        return None
