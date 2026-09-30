# Dev log

## 30 Sep 2026 (later): voice mode

Turn-based voice in any chat: speak, pause, hear the answer, and it listens again. Exit button, no barge-in.
Everything on Vertex AI: Gemini 2.5 Flash-Lite transcribes, Gemini TTS speaks as "Gacrux" in en-GB.

**What we looked at for the visual.** Deepgram UI's canvas orb, ElevenLabs UI's three.js orb, LiveKit Agents UI's
Aura shader, orb-ui and assistant-ui's own voice orb (built for realtime, interruptible sessions). We tried the
Deepgram orb, then Aura, and dropped both: neither looked like Tareekh. The visual is now the logo mark itself, with
the ruled lines, the turned corner and the red ribbon reacting to listening, thinking and speaking.

**A fabrication, caught in testing.** The first transcription prompt included the case list as a spelling aid. Given
a spoken "when is the next date in the Gorle partition case?", it answered with an invented date instead of writing the
question down, and the chat-memory step then saved that invented date as something the lawyer said. We removed the
memory, rewrote the prompt (names only, "write it down, never answer it"), and added a check in code that rejects a
transcript with more words than the recording could hold.

**Latency.** From the end of a question to her first word went from about 22 s to about 10 s on a cold server (less
once warm). Quick answers now use `reasoning_effort=low` (13 to 26 s down to 2 to 5 s, same facts in our comparison),
voice always uses Quick, the answer no longer waits for the chat-memory check (9 to 15 s, now on low effort too and
in the background), transcription runs with thinking off (one default call had stalled for 46 s), speech calls share
one kept-alive connection, and opening voice mode warms it.

## 30 Sep 2026: whole-thread context, a context meter, and a resizable sidebar

**Chats remember the whole conversation.** The agent used to get the last six messages, each cut to 2,000 characters,
so long chats lost their start. `threadctx.py` now carries every message, counted with tiktoken against a 24k-token
budget. Past 80%, a background call folds all but the newest four messages into a rolling summary
(`chat_summaries`), which goes into the system prompt. The next question waits on a per-chat lock if a compression is
running. We considered LLMLingua for compression and chose a model-written summary instead: no PyTorch on the laptop,
and it doesn't drop the dates and I.A. numbers that token-pruning can cut.

Testing it turned up two things. The agent refused "what did I ask first?" as "not in memory", because the prompt says
to answer from the memory bank; questions about the conversation now answer from the chat. And the summary didn't
keep the order of questions, so it now starts with "Asked, in order:".

**Context meter.** A ring in the chat's top bar, with a popover: tokens used of the budget, summary vs word-for-word
split, the real prompt size Gemini reported for the last request against its 1M window, the summary itself, and
Compress now.

**Resizable sidebar.** Drag the edge (200 to 440 px), double-click to reset, drag nearly shut to collapse, arrow keys
when focused. The width is a CSS variable set before first paint by the theme script, so it doesn't jump on load.

**Glass, cleaned up.** There were four different blur recipes, and modal backdrops blurred the page. Following
Apple's HIG on materials, there are now two utilities (`material`, `material-thin`), used only on floating chrome,
with solid fallbacks for Reduce Transparency; sheets and dialogs dim instead of blur.

**README** now says "we", explains thread context, and has a section on how we test.

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

- **Blank answers.** *"Did the resort group make any construction attempts?"* came back empty twice in Deep mode. No
  case was named, so the model passed "O.S. 131/2025" as a `case_id`; the tag filter matched nothing, it used all five
  steps, and the forced final answer was empty, which was saved as-is. Tool case arguments now go through the
  registry, a follow-up with no case in it borrows the case from the previous answer, an empty answer falls back to
  the Quick path or returns an error, and a retry replaces the failed turn (it used to show the question twice after
  a refresh).

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
