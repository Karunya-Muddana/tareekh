# Tareekh architecture

Tareekh is a practice-memory assistant for a litigator. The lawyer uploads what the chamber already produces (diary
photos, typed notes, certified copies, pasted text). Tareekh extracts it, files each hearing under the right case, and
stores it in [Hindsight](https://hindsight.vectorize.io). When the lawyer asks something, an agent answers from memory
and cites the source. The top-level [README](../README.md) walks through the agent and retrieval in more depth.
It remembers. It does not give legal advice.

```
            ┌──────────── FRONTEND (web/, Next.js) ─────────────┐
            │  Today · Chats · Knowledge graph · Add notes       │
            └───────────────────┬───────────────────────────────┘
                                │ REST via /backend rewrite; chat streams via /api/chat
┌───────────────────────────────▼──────────────────────────────────┐
│ FastAPI backend  (backend/app)                                   │
│                                                                  │
│  INGEST  (ingest/)                  AGENT  (agent/)              │
│  extract → segment+resolve →        context builder → tool loop  │
│  review → retain                    → answer + citations         │
│                                                                  │
│  Practice registry (SQLite, db.py + registry.py)                 │
│  cases · aliases · judges · counsel · clients · uploads · entries│
└──────────────┬────────────────────────────────┬──────────────────┘
               │                                │
   Gemini on Vertex AI (OpenAI-compat)   Hindsight (local Docker): ONE bank
   Gemini Flash: OCR, segmenter, agent   per lawyer · memories · observations
                                         · mental models · directives
```

## 1. Ingest: anything in, one memory per hearing out

| Step | Module | What happens |
|---|---|---|
| Extract | `ingest/extract.py` | `.txt`/pasted text as-is · `.docx` via python-docx · `.pdf` text layer, else page images → OCR · images → vision LLM ("transcribe exactly, skip struck-out words") |
| Segment + resolve | `ingest/segment.py` | one LLM call with the raw text **and a compact case registry**. Returns `[{case_id, hearing_date, author, doc_type, text, confidence}]`. A diary page with 3 matters gives 3 entries; an order-sheet scan with 3 dated rows gives 3 entries. "Greenfield" → C5. |
| Repair | `ingest/segment.py` | case ids are checked against the registry (fuzzy fallback). Missing dates fall back to the filename (`IMG_20260812_…`, `court_notes_2026-08-12`) or a user hint |
| Review | `routers/uploads.py` | entries are shown to the user to fix. High-confidence entries auto-confirm so bulk backlog uploads need no clicks |
| Retain | `memory.py` | one Hindsight item per entry (below) |

What each retained item looks like:

```python
{
  "content":  "[2025-06-18] O.S. No. 131 of 2025 (Seabreeze injunction) before Sri P. Suryanarayana Murthy; "
              "opposing counsel Sri V. Harsha Vardhan. Source: handwritten diary note by Aditya.\n<entry text>",
  "context":  "hearing note",
  "timestamp": "2025-06-18T10:30:00+05:30",      # the HEARING date, never the upload time
  "tags":     ["case:C3", "judge:J1", "counsel:OC2", "client:CL1", "type:note", "author:aditya"],
  "metadata": {"source_file": "IMG_20250618_164210.jpg", "upload_id": "...", "doc_type": "handwritten_note",
               "case_id": "C3", "hearing_date": "2025-06-18", "author": "Aditya"},
  "document_id": "<upload_id>:C3:2025-06-18",    # re-uploading the same file replaces rather than duplicates
}
```

Each item also sets `observation_scopes: [["judge:J1"], ["counsel:OC2"], ["case:C3"]]`. With the default scope,
Hindsight consolidates observations over the item's *full* tag set, which is effectively one scope per case, so the
cross-case judge pattern would never form. Explicit scopes make it consolidate per judge, per counsel and per case.

**Tags do the filtering and metadata does the citing.** Hindsight filters recall/reflect by tags; metadata can't be filtered,
but it comes back with every recalled fact, and that's what the UI shows as a source chip.

## 2. The agent does not go in blind: three layers of knowledge

| Layer | Where | Contents | Written by |
|---|---|---|---|
| **A. Registry** | SQLite + a one-time retain of case stubs | case numbers, nicknames, parties, court, judge, opposing counsel, client | onboarding (what the lawyer would type in) |
| **B. Bank config** | Hindsight `retain_mission`, `observations_mission`, directives | what to extract; which patterns to track; hard rules (cite sources, no legal advice, "I don't know" when there's no source, order sheet ≠ personal note) | `bank_setup.py` |
| **C. Mental models** | Hindsight, `refresh_after_consolidation` | one per **judge**, one per **opposing counsel**, **Open commitments**, **How the lawyer works** | **learned** from uploads |

Judge habits and counsel tactics are **not** seeded at onboarding. They have to show up in layer C from the notes;
that's the "learns over time" claim. Onboarding deliberately drops those fields from `world.json`.

## 3. Answering a question

```
question (+ the chat's case, + the previous question for follow-ups)
  ├─ context builder (code, no LLM): today's date, active case, fuzzy-matched cases in the question,
  │   their registry rows, mental models for their judge + counsel, "Open commitments", working style
  ├─ Quick: one tagged recall (budget low) → one completion
  ├─ Deep: tool loop (max 5 steps):
  │     find_case(text) · recall_memories(query, case_id?, judge_id?, counsel_id?)
  │     reflect(query, ...same filters) · case_timeline(case_id)
  └─ answer with [n] markers → citations resolved from recalled metadata
```

- **recall** is for "what/when" questions, and fast enough to use in court. **reflect** is for "what should I expect".
- **Function-calling fallback**: if the tool loop errors, fall back to the Quick path (resolve case → recall with its
  tags → one completion). The response says which `mode` ran.
- **Chat memories**: in parallel with the answer, the lawyer's message is checked for durable decisions or instructions,
  which are retained as `type:chat_memory` and ranked below records.

## 4. API

| Endpoint | Purpose |
|---|---|
| `POST /onboard` | load registry, configure bank + directives, create mental models, retain case stubs |
| `POST /uploads`, `GET /uploads/{id}`, `POST /uploads/{id}/confirm` | ingest: background extraction, review, retain |
| `POST /ask` | one-off answer + citations (no chat) |
| `GET/POST /chats`, `GET/DELETE /chats/{id}`, `POST /chats/{id}/messages` | chats with stored history |
| `GET /chat-memories`, `DELETE /chat-memories/{id}` | what was remembered from chats; forgetting removes it from Hindsight |
| `GET /today`, `GET /today/insights`, `GET /calendar` | cause list, learned judge profiles + open commitments, month view |
| `GET /graph`, `GET /graph/search`, `GET /entries/{id}`, `GET /entries/{id}/file` | knowledge graph, search, reading a note and its original |
| `GET /cases`, `GET /cases/{id}`, `GET /cases/resolve/{text}`, `GET /memory/status` | registry and memory health |

## 5. Decisions and why

| Decision | Why |
|---|---|
| One bank per lawyer, scoped by tags | cross-case patterns (Murthy sir's costs rule) need every case in one bank |
| Registry in SQLite, not only in Hindsight | resolving "Greenfield" and parsing a cause list need exact, deterministic lookups |
| Event-date timestamps | "last time" must mean the last hearing, not the last upload |
| Human review before retain | an OCR'd wrong date becomes a confidently wrong memory |
| OpenAI-compatible LLM client | Vertex (default) or any OpenAI-compatible provider via env vars, with a separate OCR model |
| Gemini on Vertex AI | Groq's free tier capped Hindsight at ~2 memories/min; Vertex has no practical limit and ADC means no keys in files |
| Python + FastAPI | Hindsight's Python client, and the data generator is already Python |
