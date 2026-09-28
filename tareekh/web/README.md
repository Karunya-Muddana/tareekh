# Tareekh web app

Next.js front end for Tareekh (assistant-ui + AI SDK). All the real work (OCR, memory, answers) happens in the FastAPI
backend; this app reaches it through `/backend/*` (see `next.config.ts`, `TAREEKH_BACKEND_URL`, default `http://127.0.0.1:8000`).

```bash
npm install
npm run dev        # http://localhost:3000
```

## What's where

- `app/(app)/`: signed-in screens: Today, chats, Add notes.
- `app/login/`: **simulated sign-in**. Nothing is checked; the chosen profile goes in a `tareekh_session` cookie and
  `proxy.ts` sends anyone without it to `/login`. Replace with real auth before other people use the app.
- `app/(app)/graph/`: the **knowledge graph**. Notes, order sheets, documents and chat memories linked to cases, courts,
  each other in time, and by shared meaning (`backend/app/graph.py`). Search matches words with typos allowed and by
  meaning (Hindsight recall; a local similarity match when memory is offline). Non-matches fade out; click to read the
  original photo or PDF.
- `app/brand/`: the brand guide (logo, colours, type, voice). Open `/brand`.
- `lib/cache.ts`: stale-while-revalidate cache. Screens draw from the last known data at once, then refresh; the same
  request is never sent twice at the same time; sidebar links prefetch a chat on hover.
- `lib/theme.ts`: Light / Dark / Match device, stored per browser, applied before first paint.

## Display font

The wordmark, Today's weekday and the sign-in screen use Samarkan (`app/fonts/samarkan.woff2`, © Titivillus Foundry).
It is shareware: buy a license before a public or commercial launch.

## Without API keys

`python backend/scripts/seed_local.py` loads the demo backlog's ground-truth text and original files into a local
database, with no OCR, model or Hindsight calls. Run the backend with `HINDSIGHT_URL` pointing nowhere and every
screen, including the knowledge graph, works on real notes.
