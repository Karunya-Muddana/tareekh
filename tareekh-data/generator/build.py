"""Build the demo data from story.py.

    python build.py        # writes ../data (ground truth) and ../uploads (what the lawyer would upload)
"""
import datetime as dt
import json
import os
import random
from collections import defaultdict

import render
from story import (ADVOCATE, CASES, CLIENTS, COUNSEL, DEMO_DAY, DOCS, EVAL, EXTRA_NOTES, FINAL_NEXT, HEARINGS, JUDGES)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA, UPL = os.path.join(ROOT, "data"), os.path.join(ROOT, "uploads")


def court_day(iso):
    d = dt.date.fromisoformat(iso)
    while d.weekday() >= 5:              # courts sit Mon-Fri here
        d += dt.timedelta(days=1)
    return d.isoformat()


def ddmmyyyy(iso):
    return dt.date.fromisoformat(iso).strftime("%d.%m.%Y")


def reset(path):
    os.makedirs(path, exist_ok=True)
    for root, _dirs, files in os.walk(path):   # delete files only; OneDrive may lock the folders themselves
        for f in files:
            os.remove(os.path.join(root, f))


def build_cases():
    cases = {}
    for c in CASES:
        hs = HEARINGS[c["id"]]
        dates = [court_day(h["date"]) for h in hs]
        assert dates == sorted(dates) and len(set(dates)) == len(dates), c["id"]
        out = []
        for i, h in enumerate(hs):
            nxt = dates[i + 1] if i + 1 < len(hs) else FINAL_NEXT[c["id"]]
            order = h["order"].replace("{NEXT}", ddmmyyyy(nxt) if nxt else "")
            out.append({"hearing_id": f"{c['id']}-H{i + 1:02d}", "date": dates[i], "next_date": nxt or None,
                        "order_sheet": order, "note": h["note"], "note_by": h["by"], "_fmt": h["fmt"], "_scan": h["scan"]})
        cases[c["id"]] = {**c, "next_date": FINAL_NEXT[c["id"]] or None, "hearings": out}
    return cases


def build_uploads(cases, rng):
    reset(UPL)
    manifest = []

    def folder(date):
        p = os.path.join(UPL, "backlog", date[:7])
        os.makedirs(p, exist_ok=True)
        return p

    def rel(p):
        return os.path.relpath(p, UPL).replace("\\", "/")

    def add(files, kind, by, date, case_ids, text):
        manifest.append({"files": [rel(f) for f in files], "type": kind, "author": by, "date": date,
                         "case_ids": case_ids, "source_text": text})

    def stamp(date):
        return f"{date.replace('-', '')}_{rng.randint(10, 19):02d}{rng.randint(0, 59):02d}{rng.randint(0, 59):02d}"

    # hearing notes, grouped the way people actually write them: one diary page / one typed file per person per day
    by_day = defaultdict(list)
    for c in cases.values():
        for h in c["hearings"]:
            by_day[(h["date"], h["note_by"], h["_fmt"])].append((c, h))
    for (date, by, fmt), items in sorted(by_day.items()):
        ids, texts = [c["id"] for c, _ in items], [h["note"] for _, h in items]
        if fmt == "hw":
            files = render.handwritten_pages(texts, date, by, os.path.join(folder(date), f"IMG_{stamp(date)}"), rng)
            add(files, "handwritten_note_photo", by, date, ids, "\n\n".join(texts))
        elif fmt == "txt":
            p = render.write_txt(os.path.join(folder(date), f"court_notes_{date}.txt"), date, by, texts)
            add([p], "typed_note_txt", by, date, ids, open(p, encoding="utf-8").read())
        else:
            for c, h in items:
                num = c["case_number"].replace("O.S. No. ", "OS_").replace(" of ", "-")
                p = render.write_docx(os.path.join(folder(date), f"{num}_{date}.docx"), date, by,
                                      f"{c['case_number']} - {c['short_name']}", h["note"])
                add([p], "typed_note_docx", by, date, [c["id"]], h["note"])

    # certified copies of the order sheet, each covering the entries since the previous copy
    judges = {j["id"]: j for j in JUDGES}
    for c in cases.values():
        last = 0
        for i, h in enumerate(c["hearings"]):
            if not h["_scan"]:
                continue
            ents = c["hearings"][max(last, i - 3):i + 1]
            applied = court_day((dt.date.fromisoformat(h["date"]) + dt.timedelta(days=rng.randint(1, 3))).isoformat())
            num = c["case_number"].replace("O.S. No. ", "OS_").replace(" of ", "-")
            p = render.order_sheet_scan(c, judges[c["judge_id"]], [(e["date"], e["order_sheet"]) for e in ents],
                                        os.path.join(folder(applied), f"CC_{num}_{h['date']}.jpg"), rng, applied)
            add([p], "certified_order_sheet_scan", "court", applied, [c["id"]],
                "\n".join(f"{ddmmyyyy(e['date'])}: {e['order_sheet']}" for e in ents))
            last = i + 1

    for x in EXTRA_NOTES:
        if x["fmt"] == "hw":
            files = render.handwritten_pages([x["text"]], x["date"], x["by"], os.path.join(folder(x["date"]), f"IMG_{stamp(x['date'])}"), rng, strike_prob=0)
            add(files, "handwritten_note_photo", x["by"], x["date"], x["case_ids"], x["text"])
        else:
            p = render.write_txt(os.path.join(folder(x["date"]), f"notes_{x['date']}.txt"), x["date"], x["by"], [x["text"]])
            add([p], "typed_note_txt", x["by"], x["date"], x["case_ids"], x["text"])

    for doc in DOCS:
        base = os.path.join(folder(doc["uploaded"]), doc["name"])
        if doc["kind"] == "chat":
            p = base + ".txt"
            open(p, "w", encoding="utf-8").write(doc["text"] + "\n")
            add([p], "whatsapp_export", "other", doc["uploaded"], doc["case_ids"], doc["text"])
        elif doc["kind"] == "letter":
            add(render.handwritten_letter(base, doc["text"], rng), "handwritten_letter_photo", "other",
                doc["uploaded"], doc["case_ids"], doc["text"])
        else:
            files = render.document(base, doc["pages"], rng, stamp=doc.get("stamp"), stamp_paper=doc.get("stamp_paper"),
                                    sign=doc.get("sign", ()), photo=doc.get("photo", False))
            text = "\n".join(t for pg in doc["pages"] for _, t in pg if t)
            add(files, "document_photo" if doc.get("photo") else "document_scan", "other", doc["uploaded"], doc["case_ids"], text)

    manifest.sort(key=lambda m: (m["date"], m["files"][0]))
    return manifest


def main():
    rng = random.Random(11)
    reset(DATA)
    os.makedirs(os.path.join(DATA, "cases"), exist_ok=True)
    cases = build_cases()
    world = {"advocate": ADVOCATE, "judges": JUDGES, "opposing_counsel": COUNSEL, "clients": CLIENTS,
             "cases": [{k: v for k, v in c.items() if k != "hearings"} for c in cases.values()], "demo_day": DEMO_DAY}
    json.dump(world, open(os.path.join(DATA, "world.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    manifest = build_uploads(cases, rng)
    for c in cases.values():
        for h in c["hearings"]:
            h.pop("_fmt"), h.pop("_scan")
        json.dump(c, open(os.path.join(DATA, "cases", f"{c['id']}.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    json.dump([{"question": q, "expected": a, "cases": ids} for q, a, ids in EVAL],
              open(os.path.join(DATA, "eval_questions.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    json.dump(manifest, open(os.path.join(UPL, "manifest.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    n_pages = sum(len(m["files"]) for m in manifest)
    by_type = defaultdict(int)
    for m in manifest:
        by_type[m["type"]] += len(m["files"])
    print(f"cases={len(cases)} hearings={sum(len(c['hearings']) for c in cases.values())} uploads={len(manifest)} files={n_pages}")
    print(dict(by_type))


if __name__ == "__main__":
    main()
