# Tareekh backend

FastAPI + SQLite + Hindsight. The design is in [../ARCHITECTURE.md](../ARCHITECTURE.md).

## Setup

Prerequisites: Python 3.10+, Docker Desktop running, and a Google Cloud project with the Vertex AI API enabled.

```bash
gcloud auth application-default login   # once; Tareekh and Hindsight both use these credentials
cd tareekh/backend
python -m venv .venv
.venv\Scriptsctivate                  # Windows  (source .venv/bin/activate on mac/linux)
pip install -r requirements.txt
copy .env.example .env                  # set VERTEX_PROJECT (and TODAY for the demo data)
bash scripts/start_hindsight.sh         # local Hindsight in Docker
uvicorn app.main:app --reload
```

| URL | What |
|---|---|
| http://127.0.0.1:8000/docs | Tareekh API (interactive) |
| http://127.0.0.1:8000/health | config check |
| http://127.0.0.1:8000/memory/status | is Hindsight still processing? |
| http://localhost:8888 | Hindsight API |
| http://localhost:9999 | **Hindsight control plane**: browse memories, observations, mental models (good on demo day) |

Hindsight's data persists in `~/.hindsight-docker`, so restarting the container keeps the memory bank.

### Models

All LLM work runs on Gemini via Vertex AI, authenticated with Application Default Credentials. No API keys are stored in files.

| Setting (`.env`) | Default | Used for |
|---|---|---|
| `LLM_PROVIDER=vertex`, `LLM_MODEL` | `google/gemini-3-flash-preview` | segmenting uploads, the agent |
| `VISION_MODEL` | `google/gemini-3.1-pro-preview` | OCR of diary photos and scans |
| `HINDSIGHT_LLM_PROVIDER`, `HINDSIGHT_LLM_MODEL` | `vertexai`, `gemini-3-flash-preview` | Hindsight's fact extraction, consolidation, reflect |
| `VERTEX_PROJECT`, `VERTEX_LOCATION` | your project, `global` | Gemini 3 previews are only served from `global` |

`LLM_PROVIDER=openai` plus `LLM_BASE_URL`/`GROQ_API_KEY` switches back to any OpenAI-compatible provider, and
`HINDSIGHT_LLM_PROVIDER=groq` does the same for Hindsight. On Groq's free tier Hindsight manages about 2 memories per
minute (8k tokens/min), and needs `HINDSIGHT_API_LLM_GROQ_SERVICE_TIER=on_demand`, which the start script sets.

## First run (in this order)

```bash
python scripts/onboard_demo.py          # registry + bank config + directives + mental models
python scripts/run_level.py 1           # uploads START_HERE/level1, confirms, asks "rejoinder?"
python scripts/run_level.py 1 --quick   # same question in in-court quick mode
```

Level 1 passes when the answer says: undertaken 12 Aug 2026, filed 3 Sep 2026 (diary no. 4471), receipt acknowledged
4 Sep 2026, with citations to the certified copy / diary photo / typed note.
Hindsight extracts facts asynchronously, so if the first answer is thin, wait a minute and ask again.

## Tests (no keys needed)

```bash
python -m pytest -q
```

They cover case resolution (nicknames, case numbers), extraction, segment repair and the shape of retained items.

## Layout

```
app/
  main.py            FastAPI app, /health
  config.py          env settings (.env)
  db.py              SQLite: registry + uploads + entries
  registry.py        onboarding, aliases, find_cases(), case_context()
  llm.py             OpenAI-compatible client: chat, chat_json, ocr_image
  memory.py          ALL Hindsight calls: build_item, retain, recall, reflect, mental models
  bank_setup.py      missions, directives, mental model definitions
  ingest/extract.py  txt / docx / pdf / image → text
  ingest/segment.py  text → [{case_id, hearing_date, text, ...}] + repair()
  ingest/pipeline.py upload lifecycle, confirm → retain
  agent/context.py   what the agent knows before searching (registry + mental models)
  agent/agent.py     tool loop, citations, fixed-path fallback
  routers/api.py     HTTP endpoints
scripts/             onboard_demo.py, run_level.py
tests/               offline tests
```

## Endpoints

| Method | Path | Body |
|---|---|---|
| POST | `/onboard` | `{"world": <world.json>, "configure_memory": true}` |
| POST | `/uploads` | multipart: `files[]`, `text`, optional `case_id`, `hearing_date`, `author`, `auto_confirm` |
| GET | `/uploads/{id}` | status + segmented entries |
| POST | `/uploads/{id}/confirm` | `{"edits": [{"id", "case_id?", "hearing_date?", "text?", "reject?"}], "wait": false}` |
| POST | `/ask` | `{"question", "case_id?", "quick?"}` → `{answer, citations[], mode, cases, trace}` |
| GET | `/cases`, `/cases/{id}`, `/cases/resolve/{text}` | registry |

## Known gaps (next steps)

- Image OCR is wired (`llm.ocr_image`) but untested until keys are in. Check handwriting quality on `START_HERE/level2`
  and swap `VISION_*` env vars if needed.
- No SSE yet; the UI polls `GET /uploads/{id}`.
- Morning brief, cause-list parsing, `/teach`, case timeline and the memory feed come next (ARCHITECTURE.md §5).
