# Tareekh synthetic data

Fictional but realistic practice data for **Adv. Meera Rao**, a Hyderabad civil litigator. It covers 19 months of hearings
(01.03.2025 to 02.10.2026) and a demo day on **Monday 05.10.2026**. The demo story is in [STORY.md](STORY.md).

All people, firms and cases are invented. The court structure (City Civil Court, Hyderabad and the High Court for the State of
Telangana) is real so the documents read true.

## Layout

```
tareekh-data/
├── STORY.md                  persona, demo script, planted facts
├── data/                     GROUND TRUTH: what the app should end up knowing (never upload this)
│   ├── world.json            advocate, 6 judges, 8 opposing counsel, 25 clients, 40 case stubs, court calendar
│   ├── cases/C01..C40.json   full hearing history per case (order sheet, note, action items, adjournments, costs)
│   ├── demo_day.json         cause list for 05.10.2026, 3 client WhatsApps, live-upload files
│   ├── ground_truth.json     answers the app must produce (C07/C12/C19 pattern, C23, C31, C35, OC3 count)
│   └── eval_questions.json   12 test questions with expected answers
├── uploads/                  INPUT: exactly what Meera would upload
│   ├── backlog/YYYY-MM/      ~342 files: diary photos (.jpg), phone notes (.txt), case notes (.docx), certified copies (.jpg)
│   ├── demo_live/            cause list (.pdf/.png/.txt) + two after-hearing diary photos for the live demo
│   └── manifest.json         for every upload: files, type, author, date, case_ids, hearing_ids, source_text
├── generator/                deterministic Python that builds all of the above
└── fonts/                    Kalam (Meera's hand), Caveat (Sai's hand), both OFL
```

## Upload types (what your ingestion has to handle)

| Type | Looks like | Challenge |
|---|---|---|
| `handwritten_note_photo` | phone photo of a printed court diary page (Meera, Kalam font, blue ink, date printed at the top) or Sai's plain notebook (Caveat, black ink) | OCR, skew/perspective, **up to 3 matters per page** that must be split, occasional struck-out words to ignore, cases named by nickname ("Tadepalli") rather than number |
| `typed_note_txt` | `court_notes_2026-08-18.txt`, all of one person's typed notes for a day | split per matter, resolve short names |
| `typed_note_docx` | one case note per file, heading has the case number | easy path |
| `certified_order_sheet_scan` | scanned certified copy with stamp, 1 to 4 docket entries | OCR of formal text, dates in `dd.mm.yyyy`, map entries to hearings, **overlaps with notes, so dedupe** |

Notes are informal Indian English with the odd Telugu/Hindi word (garu, amma, sare, ayyo). Abbreviations include PW1, DW1,
IA, WS, CC, OC, SC (standing counsel), "x-exam".

`manifest.json → source_text` is the exact intended text of each upload. Use it to score OCR (CER/WER), or to replay the backlog
without OCR if you're short on time or Wi-Fi on demo day. Struck-out words are not in `source_text`.

## Suggested memory mapping (Hindsight)

- One `retain` per hearing entry (after splitting), with metadata `case_id, case_number, court, judge_id, opposing_counsel_id,
  hearing_date, author, source_file, doc_type`. Keep the original `source_file` so every answer can cite it.
- Tag or context-prefix each memory with judge and counsel names so `reflect` can find cross-case patterns.
- Retain the world bible (judges, counsel, clients, case stubs) first, so short names resolve.

## Regenerate / check

```bash
cd generator
pip install pillow numpy python-docx
python build.py      # ~3-5 min, seeded, same output every run
python validate.py   # date chaining, court days, J2 costs rule, planted facts, notes-only facts, file coverage
```

Key numbers from the current build: 40 cases, 393 hearings, about 65% routine, 342 uploads, 12 OC3 illness adjournments
across 6 cases, 2 cost orders (both J2), C35 conservative appeal deadline 22.10.2026.

## Honest caveats

- The C35 limitation calculation (Art. 116(b) plus Sec. 12 exclusions) is an illustrative demo computation. The app should
  surface the dates and flag urgency, not give a legal opinion.
- Holiday and vacation dates for 2026 are approximate.
- Names were chosen to be fictional, but with common Telugu surnames a collision with a real person is possible. Grep before publishing.
