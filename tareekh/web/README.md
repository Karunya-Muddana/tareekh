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
- `app/brand/`: the brand guide (logo, colours, type, voice). Open `/brand`.
- `lib/cache.ts`: stale-while-revalidate cache. Screens draw from the last known data at once, then refresh; the same
  request is never sent twice at the same time; sidebar links prefetch a chat on hover.
- `lib/theme.ts`: Light / Dark / Match device, stored per browser, applied before first paint.

## Optional display font

The wordmark, Today's weekday and the sign-in screen use an Indic-style display face. Samarkan is shareware, so it is
not in the repo: put a licensed `samarkan.woff2` in `public/fonts/` and it switches on. Without it, Instrument Serif
with a headline bar stands in.
