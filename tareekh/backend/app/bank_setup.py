"""Layer B (bank config + directives) and layer C (mental models). Run once at onboarding; safe to re-run."""
import logging

from . import db, memory, registry
from .config import settings

log = logging.getLogger("tareekh.bank")

def mission() -> str:
    p = registry.practice()
    return (f"I am the practice memory of Adv. {p['lawyer']}, a civil litigator in {p['city']}, and his junior "
            f"{p['assistant']}. I remember what happened at every hearing of his cases, what he promised, what the "
            f"other side did, and how each judge and opposing counsel behave. I remember; I do not give legal advice.")

RETAIN_MISSION = (
    "Each item is one hearing of one court case, from the lawyer's own note or the court's order sheet. Extract: "
    "the hearing outcome; the next date and what the case is listed for; adjournments (who sought them, the stated "
    "reason, whether granted, any 'last opportunity' warning); costs imposed (amount, on whom); undertakings or "
    "promises made to the court, with deadlines; filings made (with diary/reference numbers and dates); what "
    "witnesses said (quote dates, amounts and places exactly); what the judge said orally; tasks and who owns them; "
    "what the client was told or promised. Keep case numbers, exhibit numbers (Ex.A1, Ex.B3), rupee amounts and "
    "dates verbatim. Ignore filler like 'not reached, nothing new' beyond recording that it happened.")

OBSERVATIONS_MISSION = (
    "Build durable knowledge about recurring behaviour: how each judge conducts hearings (what they ask for first, "
    "how they treat repeated adjournments, costs, undertakings, synopses, mediation); how each opposing counsel "
    "operates (reasons they give for adjournments, how often, which tactics); and what the lawyer himself routinely "
    "does. Count occurrences and name the cases and dates behind each pattern. Ignore one-off events.")

DIRECTIVES = [
    ("Cite sources", "Every factual claim must name its case and hearing date. Never state a date, amount or "
                     "reference number that is not in memory.", 100),
    ("No legal advice", "Do not give legal opinions or predict outcomes as certainties. Describe what happened and "
                        "what patterns the record shows; the lawyer decides.", 90),
    ("Admit gaps", "If memory has nothing on the question, say so plainly instead of guessing.", 80),
    ("Official vs personal", "Distinguish what the court's order sheet records from what exists only in the lawyer's "
                             "own notes (oral remarks, corridor conversations).", 70),
]


def configure_bank() -> dict:
    c = memory.client()
    c.create_bank(bank_id=settings.bank_id, name=f"{registry.practice()['lawyer']} - chamber memory", mission=mission())
    c.update_bank_config(settings.bank_id, retain_mission=RETAIN_MISSION, enable_observations=True,
                         observations_mission=OBSERVATIONS_MISSION, reflect_mission=mission(),
                         disposition_skepticism=4, disposition_literalism=4, disposition_empathy=2)
    existing = {getattr(d, "name", None) or (d.get("name") if isinstance(d, dict) else None)
                for d in (memory._get(c.list_directives(bank_id=settings.bank_id), "items") or [])}
    made = 0
    for name, content, prio in DIRECTIVES:
        if name not in existing:
            c.create_directive(bank_id=settings.bank_id, name=name, content=content, priority=prio)
            made += 1
    return {"bank": settings.bank_id, "directives_created": made}


def mental_model_specs() -> list[dict]:
    specs = []
    trig = {"refresh_after_consolidation": True, "mode": "delta"}
    for j in db.rows("SELECT id, name FROM judges"):
        specs.append({"id": memory.mental_model_id("judge", j["id"]), "name": f"Judge: {j['name']}", "tags": [f"judge:{j['id']}"],
                      "source_query": f"How does {j['name']} conduct hearings? Habits, what they ask for first, how they "
                                      f"treat adjournment requests (especially repeated ones), costs, undertakings, "
                                      f"synopses and mediation. Name the cases and dates behind each pattern.",
                      "trigger": trig, "max_tokens": 700})
    for o in db.rows("SELECT id, name FROM counsel"):
        specs.append({"id": memory.mental_model_id("counsel", o["id"]), "name": f"Counsel: {o['name']}", "tags": [f"counsel:{o['id']}"],
                      "source_query": f"How does opposing counsel {o['name']} operate across cases? How often do they seek "
                                      f"adjournments and with what stated reasons, what tactics recur, and anything that "
                                      f"contradicts their stated reasons. Give counts, cases and dates.",
                      "trigger": trig, "max_tokens": 700})
    specs.append({"id": "open-commitments", "name": "Open commitments", "tags": None,
                  "source_query": "What undertakings to the court, pending tasks, filing deadlines and promises to clients "
                                  "are still open as of the latest notes? For each: case, what, owner, due date, and whether overdue.",
                  "trigger": trig, "max_tokens": 900})
    who = registry.practice()["lawyer_short"]
    specs.append({"id": "working-style", "name": f"How {who} works", "tags": None,
                  "source_query": f"What are {who}'s recurring working habits, preferences and self-reminders across cases "
                                  f"(what he prepares for which judge, how he handles clients, rules he set for himself)?",
                  "trigger": trig, "max_tokens": 600})
    return specs


def create_mental_models() -> dict:
    c = memory.client()
    have = {memory._get(m, "id") for m in (memory._get(c.list_mental_models(bank_id=settings.bank_id), "items") or [])}
    made = 0
    for s in mental_model_specs():
        if s["id"] in have:
            continue
        c.create_mental_model(bank_id=settings.bank_id, name=s["name"], source_query=s["source_query"], tags=s["tags"],
                              max_tokens=s["max_tokens"], trigger=s["trigger"], id=s["id"])
        made += 1
    return {"mental_models_created": made}


def retain_case_stubs() -> dict:
    """Layer A into memory too, so entity resolution links names to cases."""
    items = []
    for c in db.rows("""SELECT c.*, j.name AS judge_name, o.name AS counsel_name, cl.name AS client_name FROM cases c
                        LEFT JOIN judges j ON j.id=c.judge_id LEFT JOIN counsel o ON o.id=c.opposing_counsel_id
                        LEFT JOIN clients cl ON cl.id=c.client_id"""):
        items.append({
            "content": (f"Case {c['case_number']} ({c['short_name']}): {c['title']}. Nature: {c['nature']}. {registry.practice()['lawyer_short']} represents "
                        f"the {c['represents']}; client {c['client_name']}. Court: {c['court']}, before {c['judge_name']}. "
                        f"Opposing counsel: {c['counsel_name']}."),
            "context": "case registry",
            "tags": [f"case:{c['id']}", f"judge:{c['judge_id']}", f"counsel:{c['opposing_counsel_id']}",
                     f"client:{c['client_id']}", "type:registry"],
            "metadata": {"source_file": "registry", "case_id": c["id"], "doc_type": "registry"},
            "document_id": f"registry:{c['id']}",
        })
    memory.retain_items(items)
    return {"case_stubs_retained": len(items)}
