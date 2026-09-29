# Dev log

## 29 Sep 2026: a full walk-through, and what it turned up

Went through every screen and endpoint on a clean build (types, lint, 22 tests, production build, every GET endpoint,
then Today, chat, graph, Add notes, sign-out and dark mode in the browser). What was broken or wrong:

- **"No record" and then the record.** Asked *"What did Murthy sir say about costs last time?"*, the agent said memory
  had no record, then cited the ₹2,000 costs order. Retrieval had found it. The prompt rule "say plainly when memory
  has nothing" made the model open with a denial because nothing about costs happened at the *latest* hearing. The
  rule (and the matching Hindsight directive) now says: lead with the closest fact, name the hearing "last time" means,
  never deny something you then cite.
- **Open commitments didn't know the date.** The mental model marked the 30 Sept objections deadline "not overdue" on
  5 Oct. Its question now starts with today's date, and `bank_setup` updates existing models and directives when their
  wording changes instead of only creating missing ones.
- **Yearless dates in notes.** "12/9" in a typed note got whatever year the model guessed. The segmenter now gets
  `TODAY` and a rule (latest such date on or before today). Typed notes are also named with the app's date, not the
  wall clock, since that name is the fallback hearing date.
- **Search matched "beach" to "each"** (rapidfuzz ratio 89). Fuzzy candidates must now share the first letter.
- **Chat**: the thread didn't follow a new message because CSS `scroll-smooth` fought assistant-ui's own scrolling;
  the Sources sheet showed case ids ("C2") instead of names; the brief-me question stayed in the address bar.
- **Sidebar**: deleting a second chat within the 5 s undo window brought the first one back. Pending deletes are a set now.
- **Upload**: the review card appeared below the fold with no hint; it scrolls into view now. "1 things" in the graph
  caption.

The README now has a proper section on how the agent works and how retrieval works, with the costs question as a worked
example.

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
