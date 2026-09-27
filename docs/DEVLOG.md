# Dev log

What was built, in order, including what broke and why decisions were made. Newest at the bottom.

---

## 1. Picking the problem

Considered: an incident-response agent, and a small-business assistant on top of
[ExcelMCP](https://github.com/Karunya-Muddana/ExcelMCP). Settled on **litigation practice memory** because:

- the pain is real and specific: years-long cases, 2-minute hearings, 100+ matters per lawyer;
- memory is the whole product, not a feature (25% of judging);
- the best insights are *cross-case* ("this judge penalises a third adjournment"), which is exactly what
  Hindsight's consolidation and `reflect` exist for;
- almost no other team will build it.

Guardrail from day one: **it remembers, it does not advise.** Every claim cites a source.

## 2. Synthetic data (`tareekh-data/`)

Real case notes are privileged, so the data is generated, but it is built to be realistic enough that the demo is
believable to someone who knows courts.

- **World bible** (`generator/world.py`): 1 advocate + junior, 6 judges, 8 opposing counsel, 25 clients, 40 cases.
  Real court structure (City Civil Court Hyderabad, Telangana High Court), fictional people. Court calendar with
  weekends, holidays and vacations.
- **Planted cases** (`generator/planted.py`): six hand-written histories that carry the demo: the reply undertaking (C23),
  the third-adjournment costs pattern (C07/C12/C19), a witness contradiction found only in handwritten notes (C31),
  and a missed appeal deadline (C35).
- **Filler** (`generator/fillers.py`): 34 seeded background cases, ~60% routine hearings ("not reached", leave,
  boycott, time sought) so the planted patterns read as discoveries, not plot.
- **Rendering** (`generator/render.py`): each hearing becomes what a lawyer would actually upload: a phone photo of a
  printed diary page (two different handwritings), a typed `.txt` day note, a `.docx` case note, or a scanned certified
  order sheet with a stamp. Up to 3 matters per diary page, occasional struck-out words, nicknames instead of case numbers.
- **Validator** (`generator/validate.py`): next-date chaining, court days only, the J2 costs rule holds across every
  case, planted facts present, notes-only facts never leak into order sheets, every hearing covered by an upload.
- **`uploads/START_HERE/`**: 12 files in four levels, each with one question the app must answer. Used as the
  acceptance test.

Bugs caught while building: a date loop that never advanced (hang), `.lower()` turning the `{NEXT}` placeholder
into `{next}` so 59 order sheets had no next date (caught by the validator), "Told Sri people" for organisation
clients.

## 3. Architecture (`tareekh/ARCHITECTURE.md`)

Three decisions shape everything:

1. **One Hindsight bank per lawyer, scoped by tags** (`case:`, `judge:`, `counsel:`, `client:`). Cross-case patterns
   need every case in one bank.
2. **The agent doesn't go in blind.** Three layers of knowledge: a SQLite registry for exact lookups (case numbers,
   nicknames), bank missions + directives, and **mental models** per judge / per opposing counsel / open commitments,
   which Hindsight refreshes as memories arrive.
3. **Onboarding loads only what a lawyer would type** (case list, judge and counsel names). Judge habits and counsel
   tactics are deliberately *not* seeded; they have to be learned from notes, or the "learns over time" claim is fake.

## 4. Backend scaffold (`tareekh/backend/`)

FastAPI + SQLite + `hindsight-client` + an OpenAI-compatible LLM client.

- `ingest/`: extract (txt/docx/pdf/image OCR) → segment + resolve with one LLM call → deterministic repair
  (validate case ids, fall back to filename dates, fuzzy alias match) → review → retain.
- `memory.py`: one retained item per hearing, `timestamp` = hearing date (not upload time), metadata carries the
  source file for citations, `document_id` makes re-uploads idempotent.
- `agent/`: context builder (registry + mental models) → tool loop (`find_case`, `recall_memories`,
  `reflect_on_memories`, `case_timeline`) → answer with `[n]` citations. Falls back to a fixed
  recall-then-answer path if function calling fails. `quick=true` skips the loop for in-court questions.
- 17 offline tests (no keys needed).

**Finding while reading Hindsight's client:** by default, observations consolidate over an item's *full* tag set,
which with our tags means one scope per case, so the cross-case judge pattern would never form. Every item now sets
`observation_scopes: [["judge:J2"], ["counsel:OC3"], ["case:C07"]]`.

## 5. Running it for real: provider problems

| Problem | Cause | Fix |
|---|---|---|
| Hindsight Cloud promo code didn't work | n/a | run Hindsight locally in Docker (`scripts/start_hindsight.sh`) |
| `llama-4-scout` 404 on Groq | not available on this account | tested `qwen3.8-27b` for OCR; it read the handwriting perfectly |
| Hindsight fact extraction 400 | Groq free tier rejects `service_tier=auto` | `HINDSIGHT_API_LLM_GROQ_SERVICE_TIER=on_demand` |
| Retain crashed the confirm endpoint | synchronous retain can't wait out a 429 | retains are always async; Hindsight queues and retries |
| Ingest ~2 memories/minute | Groq free tier: 8k tokens/min for Hindsight's model | moved everything to **Vertex AI** (below) |
| 40 case-stub memories starved the quota | onboarding retained one memory per case | stubs are opt-in (`retain_stubs`); hearing memories already name case/judge/counsel |
| Memory bank "disappeared" after restart | Docker volume path changed from Git-Bash style to Windows style | script now always resolves the Windows path; data persists in `~/.hindsight-docker` |

### Moving to Vertex AI

$265 of Google Cloud credit, expiring 15 Oct 2026. All LLM work now runs on Gemini via Vertex, using gcloud
Application Default Credentials (no API keys in files):

| Job | Model | Why |
|---|---|---|
| OCR | `gemini-3.1-pro-preview` | best handwriting accuracy (word-perfect on test pages, ~25 s/page) |
| Segmenter + agent | `gemini-3-flash-preview` | fast, good at JSON and tool calls |
| Hindsight (extract, consolidate, reflect) | `gemini-3-flash-preview` | no rate limits worth worrying about |

Two Gemini-3 specifics handled in `app/llm.py` and `app/agent/agent.py`: temperature is left at the model default
(Google advises against low values), and assistant tool-call turns are sent back verbatim so Gemini's thought
signatures survive.

## 6. Level 1 passes

`START_HERE/level1`: a diary photo (two matters on one page), a certified order-sheet scan (four dated rows), a typed note.

- OCR and splitting: 7 entries, correct case and date on every one, confidence 0.95–1.0.
- Retain on Vertex: ~1 minute for all 7 (was ~20 minutes on Groq free tier).
- `rejoinder?` (quick mode, case C23 open): *filed 3 Sep 2026 under diary no. 4471, one day after the 2 Sep deadline
  undertaken on 12 Aug; GHMC counsel acknowledged receipt 4 Sep*, with citations.
- Same question in natural language through the agent: same answer, the agent used `find_case` → `recall_memories`.

Fixes from reading the output: grouped citations like `[1, 17]` weren't parsed; the LLM labelled a `.txt` as
`handwritten_note` (file type now decides); "Sai Balaji case" didn't resolve (two-word party-name aliases added).

## 7. Open issue: consolidation is slow

Hindsight's consolidation step (turning facts into observations, which feed the mental models) takes 100 s+ per call
with `gemini-3-flash-preview` and hadn't completed a batch at time of writing. Level 1 doesn't need it; level 3
(cross-case patterns) does. Next: measure it properly, and try `gemini-2.5-flash` for Hindsight if Gemini 3's
thinking time is the cause.
