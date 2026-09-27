# Tareekh backend

FastAPI app. Uploads go through OCR, get split into one entry per hearing, are matched to a case, and are stored in
Hindsight. Questions go to an agent that recalls from Hindsight and cites its sources.

## Run

```powershell
copy .env.example .env                                   # set VERTEX_PROJECT
powershell -ExecutionPolicy Bypass -File start.ps1       # Hindsight (Docker) + API on :8000, opens the page
.venv\Scripts\python scripts\load_backlog.py            # optional: feed the demo uploads through the pipeline
.venv\Scripts\python -m pytest -q                        # offline tests, no keys needed
```

`start.ps1` creates the venv on first run, starts the Hindsight container only if it isn't running, and loads the case
list from `tareekh-data/data/world.json` the first time (lawyer, junior, judges, counsel, clients, cases).

## API

| Endpoint | What |
|---|---|
| `GET /` | the page: upload + ask |
| `POST /uploads` | files and/or pasted text → `upload_id` (processed in the background) |
| `GET /uploads/{id}` | status and extracted entries (case, date, text, confidence) |
| `POST /uploads/{id}/confirm` | apply edits, store entries in memory |
| `POST /ask` | `{question, case_id?, quick?}` → answer with `[n]` citations |
| `GET /memory/status` | is Hindsight still digesting? |
| `GET /cases`, `POST /onboard` | registry |

## Layout

```
app/ingest/     extract.py (txt/docx/pdf/image OCR), segment.py (split + resolve case), pipeline.py
app/agent/      context.py (what's known before recall), agent.py (tool loop + citations, fallback path)
app/memory.py   Hindsight items: one per hearing, timestamp = hearing date, tags per case/judge/counsel
app/registry.py cases, aliases ("Greenfield" → C5), and who the practice is (names come from world.json)
app/static/     index.html
scripts/        start_hindsight.sh, onboard_demo.py, load_backlog.py
```
