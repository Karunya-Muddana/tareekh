"""Context builder: what the agent knows BEFORE it touches memory (layers A and C). Plain code, no LLM."""
from .. import memory, registry
from ..config import today_iso


def _clip(s: str | None, n: int) -> str | None:
    if not s:
        return None
    return s if len(s) <= n else s[:n] + " ..."


def build(question: str, active_case_id: str | None = None, max_cases: int = 2) -> dict:
    case_ids = []
    if active_case_id and registry.get_case(active_case_id):
        case_ids.append(active_case_id)
    for hit in registry.find_cases(question, limit=3):
        if hit["case_id"] not in case_ids:
            case_ids.append(hit["case_id"])
    case_ids = case_ids[:max_cases]

    cases, models = [], {}
    for cid in case_ids:
        c = registry.case_context(cid)
        cases.append(c)
        for kind, ref, label in (("judge", c["judge_id"], c["judge_name"]), ("counsel", c["opposing_counsel_id"], c["counsel_name"])):
            mm_id = memory.mental_model_id(kind, ref)
            if mm_id not in models:
                txt = memory.get_mental_model_text(mm_id)
                if txt:
                    models[mm_id] = (label, _clip(txt, 1800))
    commitments = _clip(memory.get_mental_model_text("open-commitments"), 1800)
    style = _clip(memory.get_mental_model_text("working-style"), 900)
    return {"today": today_iso(), "case_ids": case_ids, "cases": cases, "models": models,
            "commitments": commitments, "style": style}


def render(ctx: dict) -> str:
    parts = [f"TODAY: {ctx['today']}"]
    if ctx["cases"]:
        parts.append("CASES THIS QUESTION IS PROBABLY ABOUT (from the registry):")
        for c in ctx["cases"]:
            parts.append(f"- {c['id']}: {c['case_number']} \"{c['short_name']}\" | {c['title']} | Meera for {c['represents']} | "
                         f"{c['court_hall']} ({c['judge_name']}, judge_id {c['judge_id']}) | opposing counsel {c['counsel_name']} "
                         f"(counsel_id {c['opposing_counsel_id']}) | client {c['client_name']} | stage: {c['stage']}")
    else:
        parts.append("No case matched the question directly; use find_case if it refers to one.")
    for mm_id, (label, txt) in ctx["models"].items():
        parts.append(f"<learned_profile id=\"{mm_id}\" about=\"{label}\">\n{txt}\n</learned_profile>")
    if ctx["commitments"]:
        parts.append(f"<open_commitments>\n{ctx['commitments']}\n</open_commitments>")
    if ctx["style"]:
        parts.append(f"<how_meera_works>\n{ctx['style']}\n</how_meera_works>")
    return "\n".join(parts)
