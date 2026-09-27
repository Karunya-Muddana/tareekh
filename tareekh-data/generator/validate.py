"""Checks the generated data. Exit code 1 if any hard rule fails.

    python validate.py
"""
import datetime as dt
import json
import os
import sys
from collections import Counter, defaultdict

from world import DEMO_CAUSE_LIST, is_court_day

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA, UPL = os.path.join(ROOT, "data"), os.path.join(ROOT, "uploads")
errors, warns = [], []


def err(m):
    errors.append(m)


cases = {}
for f in sorted(os.listdir(os.path.join(DATA, "cases"))):
    c = json.load(open(os.path.join(DATA, "cases", f), encoding="utf-8"))
    cases[c["id"]] = c
gt = json.load(open(os.path.join(DATA, "ground_truth.json"), encoding="utf-8"))
manifest = json.load(open(os.path.join(UPL, "manifest.json"), encoding="utf-8"))
on_list = {cid for rows in DEMO_CAUSE_LIST.values() for cid, _ in rows}

# 1. dates: chaining, court days, window, ordering
routine = total = 0
for cid, c in cases.items():
    hs = c["hearings"]
    for i, h in enumerate(hs):
        d = dt.date.fromisoformat(h["date"])
        total += 1
        if not is_court_day(d):
            err(f"{h['hearing_id']} on non-court day {d} ({d.strftime('%a')})")
        if not (dt.date(2025, 3, 1) <= d <= dt.date(2026, 10, 2)):
            err(f"{h['hearing_id']} outside history window: {d}")
        if i + 1 < len(hs) and h["next_date"] != hs[i + 1]["date"]:
            err(f"{h['hearing_id']} next_date {h['next_date']} != next hearing {hs[i + 1]['date']}")
        if i and hs[i - 1]["date"] >= h["date"]:
            err(f"{h['hearing_id']} not after previous hearing")
        if "{NEXT}" in h["order_sheet"] or "{next}" in h["order_sheet"]:
            err(f"{h['hearing_id']} unfilled {{NEXT}}")
        if h["next_date"] != "" and dt.date.fromisoformat(h["next_date"]).strftime("%d.%m.%Y") not in h["order_sheet"] and "Adjourned. List" not in h["order_sheet"]:
            warns.append(f"{h['hearing_id']} order sheet does not mention next date")
        if h["adjournment_sought_by"] or "Not reached" in h["outcome"]:
            routine += 1
        for a in h["action_items"]:
            if a["status"] == "done" and a["done_on"] and a["done_on"] < h["date"]:
                err(f"{h['hearing_id']} action done before it was created: {a['task']}")
    last = hs[-1]["next_date"]
    if (cid in on_list) != (last == "2026-10-05"):
        err(f"{cid}: on cause list={cid in on_list} but last next_date={last}")
    if not is_court_day(dt.date.fromisoformat(last)):
        err(f"{cid}: final next date {last} not a court day")

# 2. J2 rule: third+ adjournment by the same side must carry costs
for cid, c in cases.items():
    if c["judge_id"] != "J2":
        continue
    cnt = Counter()
    for h in c["hearings"]:
        s = h["adjournment_sought_by"]
        if s in ("opposing side", "Meera"):
            cnt[s] += 1
            if cnt[s] >= 3 and not h["costs_imposed"]:
                err(f"{h['hearing_id']}: third adjournment by {s} before J2 without costs")
            if cnt[s] < 3 and h["costs_imposed"]:
                err(f"{h['hearing_id']}: costs on a non-third adjournment")

# 3. planted facts
def find(cid, date):
    return next((h for h in cases[cid]["hearings"] if h["date"] == date), None)


checks = [
    ("C23", "2026-08-12", "order_sheet", "undertakes to file reply affidavit within three weeks"),
    ("C23", "2026-09-04", "note", "diary no. 4471"),
    ("C23", "2026-09-04", "note", "acknowledged receipt"),
    ("C07", "2026-06-19", "adjournment_reason", "unwell"),
    ("C07", "2026-08-18", "order_sheet", "last opportunity"),
    ("C12", "2026-02-11", "order_sheet", "Rs. 3,000"),
    ("C19", "2026-04-22", "order_sheet", "Rs. 5,000"),
    ("C19", "2026-04-22", "note", "Third time is not a request, it is a strategy"),
    ("C31", "2025-11-19", "note", "MARCH 2016"),
    ("C31", "2026-07-15", "note", "January 2017"),
    ("C35", "2026-09-08", "order_sheet", "dismissed"),
]
for cid, date, field, needle in checks:
    h = find(cid, date)
    if not h:
        err(f"planted hearing missing: {cid} {date}")
    elif needle.lower() not in str(h[field]).lower():
        err(f"planted fact missing: {cid} {date} {field} lacks '{needle}'")
# facts that must NOT be in the order sheets (demo depends on notes-only knowledge)
for cid, date, needle in [("C19", "2026-04-22", "strategy"), ("C31", "2025-11-19", "2016"), ("C31", "2026-07-15", "2017")]:
    if needle in find(cid, date)["order_sheet"]:
        err(f"{cid} {date}: '{needle}' leaked into order sheet")
opp_c07 = [h["date"] for h in cases["C07"]["hearings"] if h["adjournment_sought_by"] == "opposing side"]
if opp_c07 != ["2026-06-19", "2026-08-18"]:
    err(f"C07 opposing adjournments should be exactly 19.06 and 18.08, got {opp_c07}")
c35 = [h for h in cases["C35"]["hearings"] if h["date"] > "2026-09-08"]
if c35:
    err("C35 has hearings after the adverse order; appeal story needs none before demo day")

# 4. uploads exist and every hearing note is covered
covered = set()
for m in manifest:
    for f in m["files"]:
        if not os.path.exists(os.path.join(UPL, f)):
            err(f"manifest file missing: {f}")
    if m["type"] != "certified_order_sheet_scan":
        covered.update(m["hearing_ids"])
all_ids = {h["hearing_id"] for c in cases.values() for h in c["hearings"]}
if all_ids - covered:
    err(f"hearings without an uploaded note: {sorted(all_ids - covered)[:10]}")

# 5. name hygiene: flag very famous real names if they ever creep in
BAN = ["Chandrachud", "Ramana", "Lalit", "Khanna", "Gavai", "Nariman", "Sibal", "Rohatgi", "Salve"]
blob = json.dumps(cases) + open(os.path.join(DATA, "world.json"), encoding="utf-8").read()
import re
for b in BAN:
    if re.search(rf"\b{b}\b", blob):
        err(f"real-name hit: {b}")

types = Counter(m["type"] for m in manifest)
nfiles = sum(len(m["files"]) for m in manifest)
print(f"cases {len(cases)} | hearings {total} | routine {routine / total:.0%} | upload bundles {len(manifest)} | files {nfiles}")
print("by type:", dict(types))
print("OC3 illness adjournments:", len(gt["OC3_illness_adjournments_all_cases"]),
      [(x["case_id"], x["date"]) for x in gt["OC3_illness_adjournments_all_cases"]])
print("cost orders:", [(x["case_id"], x["date"], x["amount"]) for x in gt["costs_orders_all_cases"]])
print("C35 last date (conservative):", gt["C35_appeal_deadline"]["last_date_conservative"])
if warns:
    print(f"{len(warns)} warnings, e.g. {warns[:3]}")
if errors:
    print(f"\nFAILED: {len(errors)} errors")
    for e in errors[:40]:
        print(" -", e)
    sys.exit(1)
print("\nALL CHECKS PASSED")
