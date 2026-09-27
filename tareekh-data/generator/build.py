"""Build all Tareekh synthetic data.

    python build.py            # writes ../data and ../uploads
"""
import datetime as dt
import json
import os
import random
import shutil
from collections import defaultdict

import render
from fillers import all_histories, cn_short
from planted import EXTRA_NOTES
from world import (ADVOCATE, CASES, CLIENTS, DEMO_CAUSE_LIST, DEMO_DAY, HOLIDAYS, JUDGES, OPPOSING_COUNSEL,
                   VACATIONS, case_stub, judge, oc, next_court_day)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")
UPL = os.path.join(ROOT, "uploads")


def ddmmyyyy(iso):
    return dt.date.fromisoformat(iso).strftime("%d.%m.%Y")


def build_cases():
    hist = all_histories()
    cases = {}
    for row in CASES:
        cid = row[0]
        stub = case_stub(cid)
        hs = hist[cid]["hearings"]
        out = []
        for i, h in enumerate(hs):
            nxt = hs[i + 1]["date"] if i + 1 < len(hs) else hist[cid]["final_next"]
            rec = {
                "hearing_id": f"{cid}-H{i + 1:02d}", "hearing_no": i + 1, "date": h["date"],
                "listed_for": h["listed_for"], "outcome": h["outcome"], "next_date": nxt,
                "order_sheet": h["order_sheet"].replace("{NEXT}", ddmmyyyy(nxt)),
                "note": h["note"], "note_author": h["note_author"],
                "action_items": h["action_items"], "client_interaction": h["client_interaction"],
                "adjournment_sought_by": h["adjournment_sought_by"], "adjournment_reason": h["adjournment_reason"],
                "costs_imposed": h["costs_imposed"],
                "_upload": {"fmt": h["fmt"], "scan": h["scan"]},
            }
            out.append(rec)
        stub["next_date"] = hist[cid]["final_next"]
        stub["listed_for_next"] = stub["final_listed_for"]
        stub["hearings"] = out
        cases[cid] = stub
    return cases


# ------------------------------------------------------------------ uploads
def build_uploads(cases, rng):
    os.makedirs(UPL, exist_ok=True)
    for name in os.listdir(UPL):          # empty it rather than delete it (Windows/OneDrive may lock the folder)
        p = os.path.join(UPL, name)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    manifest = []
    by_day = defaultdict(list)        # (date, author, fmt) -> [(case, hearing)]
    for c in cases.values():
        for h in c["hearings"]:
            by_day[(h["date"], h["note_author"], h["_upload"]["fmt"])].append((c, h))

    def folder(date):
        p = os.path.join(UPL, "backlog", date[:7])
        os.makedirs(p, exist_ok=True)
        return p

    def rel(p):
        return os.path.relpath(p, UPL).replace("\\", "/")

    for (date, author, fmt), items in sorted(by_day.items()):
        items.sort(key=lambda x: x[0]["id"])
        if fmt == "hw":
            for k in range(0, len(items), 3):
                chunk = items[k:k + 3]
                stamp = f"{date.replace('-', '')}_{rng.randint(11, 17):02d}{rng.randint(0, 59):02d}{rng.randint(0, 59):02d}"
                base = os.path.join(folder(date), f"IMG_{stamp}")
                files = render.handwritten_pages([h["note"] for _, h in chunk], date, author, base, rng)
                manifest.append({"files": [rel(f) for f in files], "type": "handwritten_note_photo", "author": author,
                                 "date": date, "case_ids": [c["id"] for c, _ in chunk],
                                 "hearing_ids": [h["hearing_id"] for _, h in chunk],
                                 "source_text": "\n\n".join(h["note"] for _, h in chunk)})
        elif fmt == "txt":
            name = ("sai_" if author == "Sai Kiran" else "") + f"court_notes_{date}.txt"
            p = render.write_txt(os.path.join(folder(date), name), date, author, [h["note"] for _, h in items])
            manifest.append({"files": [rel(p)], "type": "typed_note_txt", "author": author, "date": date,
                             "case_ids": [c["id"] for c, _ in items], "hearing_ids": [h["hearing_id"] for _, h in items],
                             "source_text": open(p, encoding="utf-8").read()})
        else:
            for c, h in items:
                title = f"{cn_short(c['case_number'])} - {c['short_name']}"
                fname = f"{cn_short(c['case_number']).replace('/', '-').replace(' ', '_')}_{date}.docx"
                p = render.write_docx(os.path.join(folder(date), fname), date, author, title, h["note"])
                manifest.append({"files": [rel(p)], "type": "typed_note_docx", "author": author, "date": date,
                                 "case_ids": [c["id"]], "hearing_ids": [h["hearing_id"]], "source_text": h["note"]})

    # certified copies of order sheets: each covers entries since the previous copy for that case
    for c in cases.values():
        last = 0
        for i, h in enumerate(c["hearings"]):
            if not h["_upload"]["scan"]:
                continue
            ents = c["hearings"][max(last, i - 3):i + 1]
            applied = next_court_day(dt.date.fromisoformat(h["date"]) + dt.timedelta(days=rng.randint(1, 4))).isoformat()
            fname = f"CC_{cn_short(c['case_number']).replace('/', '-').replace(' ', '_')}_{h['date']}.jpg"
            p = render.order_sheet_scan(c, judge(c["judge_id"]), [(e["date"], e["order_sheet"]) for e in ents],
                                        os.path.join(folder(h["date"]), fname), rng, applied)
            manifest.append({"files": [rel(p)], "type": "certified_order_sheet_scan", "author": "court", "date": applied,
                             "case_ids": [c["id"]], "hearing_ids": [e["hearing_id"] for e in ents],
                             "source_text": "\n".join(f"{ddmmyyyy(e['date'])}: {e['order_sheet']}" for e in ents)})
            last = i + 1

    for x in EXTRA_NOTES:
        if x["fmt"] == "hw":
            base = os.path.join(folder(x["date"]), f"IMG_{x['date'].replace('-', '')}_{rng.randint(14, 18):02d}{rng.randint(10, 59):02d}{rng.randint(10, 59):02d}")
            files = render.handwritten_pages([x["text"]], x["date"], x["author"], base, rng, strike_prob=0)
        else:
            files = [render.write_txt(os.path.join(folder(x["date"]), f"sai_misc_{x['date']}.txt"), x["date"], x["author"], [x["text"]])]
        manifest.append({"files": [rel(f) for f in files], "type": "handwritten_note_photo" if x["fmt"] == "hw" else "typed_note_txt",
                         "author": x["author"], "date": x["date"], "case_ids": x["case_ids"], "hearing_ids": [],
                         "source_text": x["text"]})

    manifest.sort(key=lambda m: (m["date"], m["files"][0]))
    return manifest


# ------------------------------------------------------------------ demo day
def cause_list_lines(cases):
    lines = [("ADVOCATE-WISE CAUSE LIST", True),
             (f"Advocate: MEERA RAO ({ADVOCATE['enrolment_no']})    Date: Monday, 05-10-2026", True), ("", False)]
    rows = []
    for jid in ["J2", "J5", "J3", "J1"]:
        j = judge(jid)
        lines.append((("HIGH COURT FOR THE STATE OF TELANGANA - " if j["level"] == "High Court" else "CITY CIVIL COURT, HYDERABAD - ")
                      + j["court_hall"].upper() + f"  ({j['name'].split(',')[0]})", True))
        for cid, item in sorted(DEMO_CAUSE_LIST[jid], key=lambda x: x[1]):
            c = cases[cid]
            o = oc(c["opposing_counsel_id"])
            side = c["meera_represents"]
            lines.append((f"{item}.  {c['case_number']}   {c['title'].upper()}   [{c['listed_for_next'].upper()}]   "
                          f"Counsel for {side}: MEERA RAO;  Opp.: {o['name'].upper()}", False))
            rows.append({"item_no": item, "court": j["court_hall"] + ", " + j["court"], "judge_id": jid, "case_id": cid,
                         "case_number": c["case_number"], "listed_for": c["listed_for_next"]})
        lines.append(("", False))
    return lines, rows


def ground_truth(cases):
    illness = []
    for c in cases.values():
        if c["opposing_counsel_id"] != "OC3":
            continue
        for h in c["hearings"]:
            r = (h["adjournment_reason"] or "").lower()
            if h["adjournment_sought_by"] == "opposing side" and ("unwell" in r or "indisposed" in r or "ill" in r.split()):
                illness.append({"case_id": c["id"], "case_number": c["case_number"], "date": h["date"],
                                "judge_id": c["judge_id"], "reason": h["adjournment_reason"], "costs": h["costs_imposed"]})
    costs = [{"case_id": c["id"], "judge_id": c["judge_id"], "date": h["date"], "amount": h["costs_imposed"]["amount"],
              "opposing_counsel_id": c["opposing_counsel_id"], "hearing_id": h["hearing_id"]}
             for c in cases.values() for h in c["hearings"] if h["costs_imposed"]]
    j2_adj = defaultdict(lambda: {"opposing side": 0, "Meera": 0})
    for c in cases.values():
        if c["judge_id"] == "J2":
            for h in c["hearings"]:
                if h["adjournment_sought_by"] in ("opposing side", "Meera"):
                    j2_adj[c["id"]][h["adjournment_sought_by"]] += 1

    order_dt, cc_applied, cc_received = dt.date(2026, 9, 8), dt.date(2026, 9, 10), dt.date(2026, 9, 24)
    base_last = order_dt + dt.timedelta(days=30)
    excluded = (cc_received - cc_applied).days
    last_day = base_last + dt.timedelta(days=excluded)

    return {
        "C23_reply_undertaking": {
            "undertaking_given": "2026-08-12", "undertaking_text": "file reply affidavit within three weeks",
            "due": "2026-09-02", "filed_on": "2026-09-03", "filing_reference": "diary no. 4471", "late_by_days": 1,
            "receipt_acknowledged": "2026-09-04 in court by GHMC Standing Counsel Smt. Hemalatha Ravuri",
            "sources": ["C23-H06 order sheet (certified copy) + handwritten note", "C23-H07 typed note"],
        },
        "C07_third_adjournment_risk": {
            "opposing_adjournments_in_C07": j2_adj["C07"]["opposing side"],
            "dates": [h["date"] for h in cases["C07"]["hearings"] if h["adjournment_sought_by"] == "opposing side"],
            "last_order_said": "last opportunity (18.08.2026)",
            "meera_side_adjournments_in_C07": j2_adj["C07"]["Meera"],
            "J2_cost_precedents": [x for x in costs if x["judge_id"] == "J2"],
            "expectation": "OC3 likely to seek a third adjournment on 05.10.2026; J2 has imposed costs on third requests in C12 (Rs. 3,000) and C19 (Rs. 5,000).",
            "client_wants": "client CL1 asked on 18.08.2026 whether costs can be claimed",
            "corroboration": "Sai Kiran saw OC3 arguing in HC Court Hall 12 at 2.35 pm on 18.08.2026, the day his junior filed an 'indisposed' memo in C07 (note only).",
        },
        "C31_possession_contradiction": {
            "chief": {"date": "2025-11-19", "statement": "put in possession in March 2016, on the day of the sale deed (Ex.A1 dated 03.03.2016)"},
            "cross": {"date": "2026-07-15", "statement": "possession handed over after Sankranti, January 2017, when old tenant Mallesh vacated"},
            "only_in": "Meera's handwritten notes; order sheets only say 'examined in chief' / 'cross-examined'",
            "supporting": "Ex.A6 tax receipts start only in 2018; Ex.B2 electricity bills in defendant's name 2015-2017",
        },
        "C35_appeal_deadline": {
            "order": "I.A. No. 402 of 2025 in O.S. No. 145 of 2025 dismissed on 2026-09-08 (III Junior Civil Judge)",
            "appeal": "C.M.A. before the Chief Judge, City Civil Court (appeal to a court other than the High Court)",
            "certified_copy_applied": "2026-09-10 (CA no. 3907/2026)", "certified_copy_received": "2026-09-24",
            "limitation_rule_assumed": "Limitation Act Art. 116(b): 30 days; Sec. 12(1) excludes day of order; Sec. 12(2) excludes copy time",
            "last_date_conservative": last_day.isoformat(),
            "computation": f"{order_dt} + 30 days = {base_last}; + {excluded} days copy time (10.09 to 24.09) = {last_day}",
            "status_on_demo_day": "NOT FILED. Action item 'compute limitation and draft C.M.A.' (Sai Kiran) pending since 2026-09-08, due 2026-09-25, overdue.",
            "promise_to_client": "Meera told the client on 2026-09-08 'we will file the appeal (C.M.A.) well in time'.",
            "caution": "Synthetic computation for demo only. The app should show dates and flag urgency, and a lawyer must verify limitation.",
        },
        "OC3_illness_adjournments_all_cases": illness,
        "costs_orders_all_cases": costs,
        "J2_adjournment_counts": dict(j2_adj),
    }


def eval_questions():
    Q = [
        ("Did I undertake to file the rejoinder in the Sai Balaji WP? Was it filed?",
         "Yes. Undertaken on 12.08.2026 (within three weeks, recorded in the order). Filed 03.09.2026, diary no. 4471, one day after the 02.09 due date. GHMC standing counsel acknowledged receipt in court on 04.09.2026.", ["C23"]),
        ("rejoinder?  (asked on 05.10.2026 while in Court Hall 12)",
         "Same as above; the app should resolve 'rejoinder' to C23 because it is the matter being called in Court Hall 12.", ["C23"]),
        ("How many adjournments has the other side taken in Tadepalli and what did the judge say last time?",
         "Two, both citing counsel's illness (19.06.2026, 18.08.2026). On 18.08.2026 the order said 'last opportunity'.", ["C07"]),
        ("Has IV ACJ imposed costs for a third adjournment before?",
         "Yes: C12 on 11.02.2026 (Rs. 3,000 on defendant, OC3) and C19 on 22.04.2026 (Rs. 5,000 on plaintiff, OC5, with the oral remark 'Third time is not a request, it is a strategy').", ["C12", "C19"]),
        ("How many times has Venugopal Achary sought time citing illness, across all my matters?",
         "See ground_truth.OC3_illness_adjournments_all_cases (count and dates).", ["C07", "C12", "C14", "C27", "C30", "C37"]),
        ("What did PW1 say about possession in Gudivada v Kasoju?",
         "In chief (19.11.2025): March 2016, on the sale deed day. In cross (15.07.2026): after Sankranti, January 2017, when tenant Mallesh vacated.", ["C31"]),
        ("Did we file the appeal for Sunitha?",
         "No. I.A. 402/2025 dismissed 08.09.2026; certified copy applied 10.09, received 24.09; limitation computation and C.M.A. draft pending with Sai Kiran (overdue since 25.09). Conservative last date 22.10.2026, verify.", ["C35"]),
        ("What does Pinnamaneni J usually want?",
         "Synopsis when paper book exceeds 200 pages; records undertakings verbatim and checks compliance; interim orders only for fixed periods; short written submissions.", ["C23", "C10", "C15"]),
        ("What should I carry for Somayajulu J matters?",
         "A one-page list of dates and an answer on limitation/delay; he asks about delay first.", ["C11", "C29", "C40"]),
        ("What is pending from my side before 5 Oct?",
         "Pending action items across cases, e.g. C07 press for costs, C19 PW1 cross prep, C31 arguments note on contradiction, C35 C.M.A. (overdue).", []),
        ("What did I tell Gopal garu last time?",
         "On 18.08.2026: that we will press for costs if a third adjournment is sought.", ["C07"]),
        ("Where is the setback point in the Sai Balaji WP?",
         "R3 alleges 1.2 m setback violation on the east side; approved plan shows 1.5 m left; approved plan flagged at page 64.", ["C23"]),
    ]
    return [{"question": q, "expected": a, "cases": c} for q, a, c in Q]


def build_demo_live(rng, cases):
    d = os.path.join(UPL, "demo_live")
    os.makedirs(d, exist_ok=True)
    lines, rows = cause_list_lines(cases)
    render.printed_cause_list(lines, os.path.join(d, "cause_list_2026-10-05.pdf"), os.path.join(d, "cause_list_2026-10-05.png"))
    with open(os.path.join(d, "cause_list_2026-10-05.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(t for t, _ in lines) + "\n")
    live = [
        ("IMG_20261005_114702", "Meera", ["OS 318/22 Tadepalli - 5/10. Achary junior came with illness memo AGAIN (3rd time). I pressed for "
         "costs, showed IV ACJ his own orders in Lakshmi Ganapathi (3000) and Kamala Devi (5000). Judge granted time but imposed "
         "Rs 4000 costs payable to plaintiff before next date + 'no further adjournment'. DW1 cross on 2 Nov. Call Gopal garu."]),
        ("IMG_20261005_163015", "Meera", ["Gudivada v Kasoju - 5/10. Argued the possession contradiction, Quadri sir noted both "
         "dates and asked for Ex.A6 and B2 - gave exact numbers. Jadhav reply on 19 Oct. Judgment after that."]),
    ]
    items = []
    for base, author, text in live:
        files = render.handwritten_pages(text, "2026-10-05", author, os.path.join(d, base), rng, strike_prob=0)
        items.append({"files": [os.path.relpath(f, UPL).replace("\\", "/") for f in files], "type": "handwritten_note_photo",
                      "author": author, "date": "2026-10-05", "source_text": text[0],
                      "purpose": "upload live during demo after the hearing"})
    return rows, items


def main():
    rng = random.Random(7)
    os.makedirs(os.path.join(DATA, "cases"), exist_ok=True)
    cases = build_cases()
    world = {"advocate": ADVOCATE, "judges": JUDGES, "opposing_counsel": OPPOSING_COUNSEL, "clients": CLIENTS,
             "cases": [{k: v for k, v in c.items() if k != "hearings"} for c in cases.values()],
             "calendar": {"vacations": VACATIONS, "holidays": HOLIDAYS, "demo_day": DEMO_DAY.isoformat()}}
    json.dump(world, open(os.path.join(DATA, "world.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    manifest = build_uploads(cases, rng)
    rows, live = build_demo_live(rng, cases)
    for c in cases.values():
        for h in c["hearings"]:
            h.pop("_upload")
        json.dump(c, open(os.path.join(DATA, "cases", f"{c['id']}.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    demo = {
        "date": "2026-10-05",
        "cause_list": rows,
        "client_messages": [
            {"time": "07:41", "client_id": "CL1", "case_id": "C07", "from": "Gopal Krishna Tadepalli",
             "text": "Good morning madam. Today is 5th. I have taken leave again. Hope they don't take adjournment this time also. Can we ask costs like you said?"},
            {"time": "08:12", "client_id": "CL5", "case_id": "C35", "from": "Sunitha Raghunath",
             "text": "Madam good morning. Builder started slab work on 4th floor today, lorries coming since 6am. Did we file the appeal? You said well in time. Please tell me, I am very tensed."},
            {"time": "09:05", "client_id": "CL4", "case_id": "C23", "from": "Ravi Shankar Mallela (Sai Balaji Residency)",
             "text": "Madam, committee meeting tonight. Members asking whether stay will continue after today's hearing. Kindly send written update after court."},
        ],
        "live_uploads": live,
    }
    json.dump(demo, open(os.path.join(DATA, "demo_day.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    json.dump(ground_truth(cases), open(os.path.join(DATA, "ground_truth.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    json.dump(eval_questions(), open(os.path.join(DATA, "eval_questions.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    json.dump(manifest, open(os.path.join(UPL, "manifest.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    n_h = sum(len(c["hearings"]) for c in cases.values())
    n_f = sum(len(m["files"]) for m in manifest)
    print(f"cases={len(cases)} hearings={n_h} upload_bundles={len(manifest)} files={n_f}")


if __name__ == "__main__":
    main()
