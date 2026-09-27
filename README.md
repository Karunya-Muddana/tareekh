# Tareekh

**Practice memory for Indian litigators, built on [Hindsight](https://hindsight.vectorize.io).**

A civil case in India runs for years across dozens of two-minute hearings. The lawyer's record of what happened at each
one lives in a paper diary, a notes app and a junior's notebook. Tareekh takes those notes as they are (photos of
handwritten diary pages, typed notes, scanned court orders, pasted text), files each hearing under the right case,
and stores it in Hindsight. The lawyer can then ask "rejoinder?" while standing in court and get the answer, with the
source note, in a couple of seconds.

It remembers; it does not give legal advice. Every answer cites the note or order it came from.

> Built for the *AI Agents That Learn Using Hindsight* hackathon. "Tareekh" means *date*, as in *tareekh pe tareekh*,
> the line every Indian knows about endless adjournments.

## What makes it more than search

Hindsight's memory lets the agent learn things no single document says:

- **Recall across time.** A witness said "March 2016" in November and "January 2017" in July. Both statements exist only
  in the lawyer's handwritten notes, eight months apart.
- **Patterns across cases.** "This judge imposes costs on a third adjournment" is learned from two *other* cases and
  applied to the one being heard today.
- **Commitments.** Undertakings given to the court, tasks delegated to the junior, promises made to clients, and which of
  them are overdue.

## Repository layout

```
.
├── tareekh/                 the application
│   ├── ARCHITECTURE.md      design: ingest pipeline, memory model, agent
│   └── backend/             FastAPI service (Python)
├── tareekh-data/            synthetic practice data for development and the demo
│   ├── STORY.md             persona, demo script, planted facts
│   ├── uploads/             342 files as a lawyer would upload them (+ START_HERE/ test levels)
│   ├── data/                ground truth: case histories, expected answers
│   └── generator/           deterministic generator + validator
└── docs/
    ├── DEVLOG.md            what was built, in order, and what went wrong
    └── GLOSSARY.md          the legal terms, explained for engineers
```

## Quick start

Requirements: Python 3.10+, Docker Desktop, a Google Cloud project with Vertex AI enabled
(`gcloud auth application-default login` done once).

```bash
cd tareekh/backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env               # set VERTEX_PROJECT
bash scripts/start_hindsight.sh      # Hindsight in Docker: API :8888, UI :9999
uvicorn app.main:app --reload        # Tareekh API :8000, docs at /docs
python scripts/onboard_demo.py       # load the lawyer's case list + configure memory
python scripts/run_level.py 1        # upload START_HERE/level1 and ask "rejoinder?"
```

Details in [tareekh/backend/README.md](tareekh/backend/README.md).

## Status

| Piece | State |
|---|---|
| Synthetic data (40 cases, 393 hearings, 342 uploads, validator) | done |
| Ingest: txt / docx / pdf / image OCR → split per hearing → resolve case → Hindsight | working |
| Ask: agent with recall / reflect tools, citations, fallback path, in-court quick mode | working |
| Test level 1 (single case, three file types) | **passing** |
| Levels 2–4 (recall across time, cross-case patterns, dropped tasks) | in progress |
| Morning brief, cause-list parsing, `/teach`, frontend | planned |

See [docs/DEVLOG.md](docs/DEVLOG.md) for the full history.
