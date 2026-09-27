# Dev log

## 27 Sep 2026: reset to a simple prototype

The first version had a 40-case, 393-hearing synthetic practice and a five-step setup. It was too big to demo or debug,
so everything story-specific was deleted (data, generator, local DB, the Hindsight memory bank) and rebuilt small.

**New data.** One lawyer (Aditya Varma), one junior (Divya), two judges with opposite temperaments, five cases. Three
cases share one piece of land, one company and one witness, so cross-case memory has something real to find. The whole
story is hand-written in `tareekh-data/generator/story.py`; `build.py` renders it into 79 uploads.

**More realistic uploads.**
- Diary photos are pocket-diary pages that fill the frame, with handwriting at a normal size.
- A phone-camera pass in `render.py`: barrel distortion, chromatic aberration, vignetting, soft corners, shadow-heavy
  sensor noise, occasional hand-shake blur.
- New document types: stamp-paper agreements with signature blocks (one left blank), a sale deed with the SRO seal,
  the 1-B ROR extract, an encumbrance certificate, a police petition receipt, a mediation report, a handwritten
  letter between the friends, and a WhatsApp export.

**Backend no longer hardcodes a persona.** The lawyer's and junior's names and the city are loaded from `world.json`
into a `practice` table at onboarding, and every prompt (agent, segmenter, bank mission, mental models) reads them
from there.

**One command to run.** `start.ps1` starts Hindsight if needed, waits for it, starts the API, onboards on first run,
and opens a single page (`/`) for uploading and asking. `scripts/load_backlog.py` feeds the demo uploads through the
real pipeline.

## Earlier (kept because they still apply)

- All LLM work runs on Gemini via Vertex AI with gcloud ADC. Groq's free tier was too rate-limited.
- Hindsight runs locally in Docker (`scripts/start_hindsight.sh`). The data lives in `~/.hindsight-docker`, and the
  worker id is pinned so tasks survive a container restart.
- Gemini 3.x thinks before answering, so Hindsight's LLM timeouts are raised to 300 s (reflect 120 s).
- Each retained item sets `observation_scopes` per judge, counsel and case. Without this, observations consolidate
  per full tag set and cross-case patterns never form.
- One memory per hearing, `timestamp` = hearing date, `document_id` makes re-uploads idempotent.
