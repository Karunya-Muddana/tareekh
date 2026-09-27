"""Generates routine hearing histories for the 34 background cases.

Rules enforced here (the validator re-checks them):
- ~60% of hearings are routine (not reached, leave, time sought, boycott).
- Before J2 no side gets a third adjournment in a filler case (J2 would impose costs,
  and the demo's cost pattern should come only from the planted C12/C19 orders).
- Opposing counsel behave per their tactics; OC3 mostly cites illness.
- Judge habits show up in Meera's notes.
"""
import datetime as dt
import random

from world import (CASES, DEMO_CAUSE_LIST, HISTORY_END, case_stub, client, is_court_day, judge,
                   next_court_day, oc)
from planted import A, H, PLANTED

STEPS = {
    "suit": ["appearance of defendants", "filing of written statement", "framing of issues", "chief-examination of PW1",
             "cross-examination of PW1", "evidence of PW2", "chief-examination of DW1", "cross-examination of DW1", "arguments"],
    "wp": ["admission", "counter-affidavit by respondents", "reply affidavit", "hearing"],
    "crp": ["admission", "notice to respondents", "hearing"],
    "cma": ["admission", "notice to respondents", "hearing"],
    "as": ["admission", "call for records from trial court", "hearing"],
}

ON_LIST = {cid for rows in DEMO_CAUSE_LIST.values() for cid, _ in rows}

SPRINKLE = ["", "", "", " Sare.", " Chalo.", " Ayyo.", " Tension ledu.", " Same old story.", " Bas."]


def fmt_d(d):
    return d.strftime("%d.%m.%Y")


def surname(name):
    n = name.replace("(Senior Counsel)", "").replace("Sri ", "").replace("Smt. ", "").replace("Ch. ", "").replace("R. ", "").strip()
    return n.split()[-1]


def client_short(cl):
    n = cl["name"]
    if "Association" in n:
        return "the association secretary"
    if "Committee" in n:
        return "the temple committee"
    if n.startswith("M/s") or "LLP" in n or "Pvt" in n:
        return "the client's office"
    first = n.replace("Sri ", "").replace("Smt. ", "").replace("Dr. ", "").split()[0]
    return first + (" garu" if not n.startswith("Smt.") else " amma")


def cn_short(case_number):
    # "O.S. No. 1180 of 2021" -> "OS 1180/21"
    p = case_number.replace("No. ", "").split()
    kind = p[0].replace(".", "")
    return f"{kind} {p[1]}/{p[3][2:]}"


def progress_texts(step, c, rng):
    """(order_sheet, note, outcome, actions) for a hearing that moves the case forward."""
    ours_pw = c["meera_represents"] in ("plaintiff", "petitioner", "appellant")
    O = surname(oc(c["opposing_counsel_id"])["name"])
    who_cross_pw = "counsel for defendant" if ours_pw else "counsel for plaintiff"
    hc = c["court_level"] == "High Court"
    nxt = "List on {NEXT}." if hc else "Call on {NEXT}."
    nxl = "list on {NEXT}." if hc else "call on {NEXT}."
    T = {
        "appearance of defendants": (
            f"Defendants served. Vakalat filed for defendants by Sri/Smt. {O}. For written statement, {nxl}",
            f"{O} filed vakalat for the other side. They will take time for WS, obviously.",
            "Defendants appeared; vakalat filed"),
        "filing of written statement": (
            f"Written statement filed on behalf of the defendants. Copy served. For framing of issues, {nxl}",
            f"WS filed by {O}. Mostly bare denials. Para 9 takes a new plea we must answer in evidence." if ours_pw else
            f"Our WS filed today, copy served on {O} in court.",
            "Written statement filed"),
        "framing of issues": (
            f"Issues framed. For {'plaintiff' if c['kind']=='suit' else 'petitioner'}'s evidence, {nxl}",
            f"Issues framed - {rng.choice(['3', '4', '5'])} issues plus relief. Draft PW1 chief affidavit now.",
            "Issues framed"),
        "chief-examination of PW1": (
            f"Chief-examination affidavit of PW1 filed. Exs. A1 to A{rng.randint(4, 14)} marked. For cross-examination of PW1, {nxl}",
            "Our PW1 affidavit filed and documents marked." if ours_pw else f"Their PW1 affidavit filed by {O}. Go through it para by para.",
            "PW1 chief-examination affidavit filed; exhibits marked"),
        "cross-examination of PW1": (
            f"PW1 cross-examined by {who_cross_pw} and discharged. {nxt}",
            (f"{O} cross-examined our PW1 for {rng.choice(['40 min', 'an hour', 'nearly 2 hours'])}. Client held up mostly, "
             f"one wobble on dates.") if ours_pw else
            f"Cross of their PW1 done. Got a useful admission on {rng.choice(['the boundaries', 'the payment dates', 'the notice', 'possession'])}.",
            "PW1 cross-examined and discharged"),
        "evidence of PW2": (
            f"PW2 examined in chief and cross-examined. Discharged. {nxt}",
            "PW2 done." + rng.choice(["", " Short cross.", " Witness was nervous but ok."]),
            "PW2 examined and discharged"),
        "chief-examination of DW1": (
            f"Chief-examination affidavit of DW1 filed. Exs. B1 to B{rng.randint(2, 9)} marked. For cross-examination of DW1, {nxl}",
            f"{O}'s DW1 affidavit filed. Need to prepare cross." if ours_pw else "Our DW1 affidavit filed, exhibits marked.",
            "DW1 chief-examination affidavit filed"),
        "cross-examination of DW1": (
            f"DW1 cross-examined and discharged. Evidence closed. For arguments, {nxl}",
            "Cross of DW1 done. Evidence closed, arguments next." if ours_pw else f"{O} cross-examined our DW1. Evidence closed.",
            "DW1 cross-examined; evidence closed"),
        "arguments": (
            f"Arguments heard in part. {nxt}", "Argued for about 40 min, part-heard.", "Arguments heard in part"),
        "admission": (
            f"Heard. Admit. Notice to respondents. {nxt}",
            "Admitted, notice ordered." + (" Somayajulu J first asked why we came after 5 months - explained, he accepted." if c["judge_id"] == "J1" else ""),
            "Admitted; notice ordered"),
        "counter-affidavit by respondents": (
            f"Counter-affidavit filed on behalf of the respondents. {nxt}",
            f"Counter filed by {O}. Our reply to be filed.", "Counter-affidavit filed"),
        "reply affidavit": (
            f"Reply affidavit filed on behalf of the petitioner. List for hearing on {{NEXT}}.",
            "Our reply filed. Now final hearing.", "Reply affidavit filed"),
        "notice to respondents": (
            f"Service of notice on respondents complete. {nxt}", "Service complete. Ready for hearing.", "Service complete"),
        "call for records from trial court": (
            f"Records received from the trial court. For hearing, {nxl}", "Lower court records received.", "Trial court records received"),
        "hearing": (
            f"Heard in part. {nxt}", "Argued in part. Will finish next date.", "Heard in part"),
    }
    o, n, out = T[step]
    return o, n, out


HABIT_LINES = {
    "J1": ["Somayajulu J asked about limitation and delay first, before anything else. As always.",
           "He wanted a list of dates on one page before hearing - keep it ready in every J1 matter.",
           "He dictated the order in open court immediately."],
    "J2": ["IV ACJ started 10.30 sharp, called the list twice before lunch."],
    "J3": ["Pinnamaneni J extended interim only till next date, never 'until further orders'.",
           "She asked for short written submissions after arguments."],
    "J4": ["Doddapaneni madam asked whether parties tried mediation. Again.",
           "Madam suggested mediation centre - client not keen."],
    "J5": ["Quadri sir took it only after lunch.", "Quadri sir wanted exact exhibit numbers, not descriptions."],
    "J6": ["Tummala madam checked vakalat and service first, as usual.", "Madam returned a document for page-numbering defect."],
}

OPP_REASONS = {
    "OC1": ["filed a fresh I.A. yesterday and wants time to argue it", "sought time to file objections to marking of documents"],
    "OC2": ["sought time to file written submissions on maintainability", "wants to raise jurisdiction as preliminary issue, sought time"],
    "OC3": ["counsel unwell, memo filed by junior", "counsel indisposed, letter circulated", "counsel held up in High Court"],
    "OC4": ["parties are talking settlement, sought time", "sought time saying client is considering Lok Adalat"],
    "OC5": ["their witness not ready", "sought time as witness is out of station"],
    "OC6": ["claimed she was not served with our copy", "claimed our documents were served late, sought time"],
    "OC7": ["junior sought pass-over saying senior is in High Court, never returned", "senior counsel busy in another court"],
    "OC8": ["consent adjournment, both sides needed time", "sought one week for instructions, fair enough"],
}


def routine(c, rng, allow_opp, allow_ours):
    hc = c["court_level"] == "High Court"
    nxt = "List on {NEXT}." if hc else "Call on {NEXT}."
    ocid = c["opposing_counsel_id"]
    O = surname(oc(ocid)["name"])
    kinds = ["not_reached"] * 36 + ["leave"] * 10 + ["opp"] * (26 if allow_opp else 0) + ["ours"] * (7 if allow_ours else 0) + ["boycott"] * 6
    k = rng.choice(kinds)
    if k == "not_reached":
        return dict(order="Not reached. " + nxt if not hc else "Not reached. " + nxt,
                    note=rng.choice(["Not reached.", "Not reached, long list.", f"Not reached. Item {rng.randint(30, 70)}, no chance.",
                                     "Not reached. Nothing new.", "Not reached - court busy with a part-heard matter."]),
                    outcome="Not reached", adj=None, reason=None)
    if k == "leave":
        return dict(order=("The Court is not sitting today. " if hc else "Presiding Officer on leave. ") + ("Adjourned. " if hc else "Adjourned to {NEXT}.") + (nxt if hc else ""),
                    note=rng.choice(["Judge on leave.", "Judge on leave. Wasted morning.", "No court today, judge on leave."]),
                    outcome="Presiding officer on leave", adj="court", reason="presiding officer on leave")
    if k == "boycott":
        return dict(order="Advocates abstained from work on the call of the Bar Association. " + nxt,
                    note="Bar association boycott, no work. Adjourned.", outcome="Advocates abstained from work (boycott)",
                    adj="court", reason="Bar Association call to abstain from work")
    if k == "ours":
        r = rng.choice(["counsel part-heard in another court", "client unwell", "documents awaited from client"])
        return dict(order=f"Counsel for the {c['meera_represents']} seeks time. Granted. {nxt}",
                    note=f"We sought time - {r}.", outcome=f"Time sought by our side ({r})", adj="Meera", reason=r)
    reasons = OPP_REASONS[ocid]
    if ocid == "OC3":
        r = reasons[0] if rng.random() < 0.75 else rng.choice(reasons[1:])
    else:
        r = rng.choice(reasons)
    order = (f"Learned counsel for the respondents seeks time. {nxt}" if hc else
             ("Counsel for the other side absent. Memo filed that counsel is unwell. Adjourned. " + nxt if "unwell" in r or "indisposed" in r
              else f"Counsel for the {'defendant' if c['meera_represents'] in ('plaintiff', 'appellant', 'petitioner') else 'plaintiff'} seeks time. Granted. {nxt}"))
    return dict(order=order, note=f"{O} sought time - {r}.", outcome=f"Adjournment sought by opposing side ({r})",
                adj="opposing side", reason=r)


def gen_dates(c, rng):
    hc = c["court_level"] == "High Court"
    filed = dt.date.fromisoformat(c["filed_on"])
    start = max(dt.date(2025, 3, 3) + dt.timedelta(days=rng.randint(0, 110)), filed + dt.timedelta(days=21))
    d = next_court_day(start)
    on_list = c["id"] in ON_LIST
    dates = []
    lo, hi = (35, 85) if hc else (28, 63)
    while True:
        dates.append(d)
        cand = next_court_day(d + dt.timedelta(days=rng.randint(lo, hi)))
        if on_list and cand >= dt.date(2026, 9, 7):
            return dates, dt.date(2026, 10, 5)
        if not on_list and cand > HISTORY_END:
            if cand == dt.date(2026, 10, 5):
                cand = next_court_day(cand + dt.timedelta(days=1))
            return dates, cand
        d = cand


def build_filler(cid, seed):
    rng = random.Random(seed)
    c = case_stub(cid)
    dates, final_next = gen_dates(c, rng)
    n = len(dates)
    steps = STEPS[c["kind"]]
    steps = steps[: steps.index(c["final_listed_for"]) + 1]
    k = max(1, min(len(steps) - 1, round(n * rng.uniform(0.3, 0.45))))
    steps = steps[len(steps) - 1 - k:]            # earlier stages happened before 2025
    prog_idx = set(rng.sample(range(n), k))
    hearings = []
    si = 0
    opp_adj = ours_adj = 0
    j2 = c["judge_id"] == "J2"
    cl = client(c["client_id"])
    for i, d in enumerate(dates):
        listed = steps[si]
        tag = f"{c['short_name']} ({cn_short(c['case_number'])})"
        if i in prog_idx:
            order, note, outcome = progress_texts(listed, c, rng)
            if rng.random() < 0.4:
                note += " " + rng.choice(HABIT_LINES[c["judge_id"]])
            actions = []
            if rng.random() < 0.45:
                t = rng.choice([("prepare cross-examination notes", "Meera"), ("get certified copy of order", "Sai Kiran"),
                                ("collect original documents from client", "client"), ("draft written submissions", "Meera"),
                                ("prepare list of dates", "Sai Kiran"), ("serve copy on other side and file proof", "Sai Kiran")])
                actions.append({"task": t[0], "owner": t[1], "due": None, "status": None, "done_on": None, "reference": None})
            client_line = None
            if rng.random() < 0.3:
                client_line = f"Updated {client_short(cl)} about today's progress and next date."
                note += f" Told {client_short(cl)} the next date."
            h = H(d.isoformat(), listed, outcome, order, f"{tag} - {note}",
                  progress=True, actions=actions, client=client_line)
            si += 1
        else:
            allow_opp = not (j2 and opp_adj >= 2)
            allow_ours = not (j2 and ours_adj >= 2) and ours_adj < 2
            r = routine(c, rng, allow_opp, allow_ours)
            if r["adj"] == "opposing side":
                opp_adj += 1
            if r["adj"] == "Meera":
                ours_adj += 1
            note = r["note"]
            if r["adj"] == "opposing side" and cl and rng.random() < 0.3:
                note += f" {client_short(cl)} {rng.choice(['was not happy', 'asked how long this will go on', 'wanted to know if we can object'])}."
            h = H(d.isoformat(), listed, r["outcome"], r["order"], f"{tag} - {note}{rng.choice(SPRINKLE)}", adj=r["adj"], adj_reason=r["reason"])
        h["note_author"] = "Sai Kiran" if (not h["progress"] and rng.random() < 0.3) else "Meera"
        roll = rng.random()
        h["fmt"] = "hw" if roll < 0.4 else ("txt" if roll < 0.82 else "docx")
        h["scan"] = h["progress"] and rng.random() < 0.15
        hearings.append(h)
    # resolve action items: due on next date, done a few days before it, except on the last hearing
    for i, h in enumerate(hearings):
        nd = dt.date.fromisoformat(hearings[i + 1]["date"]) if i + 1 < len(hearings) else final_next
        for a in h["action_items"]:
            a["due"] = nd.isoformat()
            if i + 1 < len(hearings):
                a["status"], a["done_on"] = "done", (nd - dt.timedelta(days=rng.randint(1, 6))).isoformat()
            else:
                a["status"] = "pending"
    return {"final_next": final_next.isoformat(), "hearings": hearings}


def all_histories(seed=2026):
    out = {}
    for row in CASES:
        cid = row[0]
        out[cid] = PLANTED[cid] if cid in PLANTED else build_filler(cid, seed * 100 + int(cid[1:]))
    return out
