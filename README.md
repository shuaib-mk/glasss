# Sunni AI

Sunni AI is a React and Express knowledge assistant backed by Groq. This version is intentionally tuned for free-tier use: streamed answers, short context, session-only chat history, on-demand image OCR, and lightweight local document lookup.

## What this repaired version changes

- Keeps Groq credentials out of the browser bundle and sends all model requests through the backend.
- Parses streamed events correctly even when JSON is split across network packets.
- Uses matching uploaded knowledge documents in answers and returns source filenames as citations.
- Treats uploaded documents as untrusted reference text, never as application instructions.
- Keeps at most 20 chats in the current browser tab and clears them when the tab closes.
- Performs no Supabase chat, message, or telemetry writes in the normal chat path.
- Sends at most eight recent messages and roughly 8,000 characters of conversation context to Groq.
- Adds at most one 700-character knowledge excerpt, without embeddings or a paid RAG pipeline.
- Caches up to 100 identical completed requests per running server instance.
- Validates request sizes, models, upload types, upload sizes, and filenames.
- Removes browser-accessible global database purge controls and default admin passcodes.
- Adds deployable Vercel API entry points for chat and document routes.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Put a valid `GROQ_API_KEY` in `.env`.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open `http://localhost:5173`.

The Vite frontend proxies `/api` requests to the Express server on port 3001.

## Environment variables

Required:

- `GROQ_API_KEY`: server-side Groq credential.

Optional:

- `PORT`: local backend port; defaults to `3001`.
- `VITE_API_URL`: a separate backend origin. Leave empty for same-origin production and local Vite proxying.
- `ALLOWED_ORIGINS`: comma-separated origins when the frontend and backend are hosted separately.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: optional admin database visibility only. Normal chats do not depend on Supabase.
- `VITE_ADMIN_PASSCODE`: enables the local admin configuration screen. This is a convenience gate compiled into frontend code, not secure production authentication.

Never commit `.env`. Rotate any provider key that was previously placed in browser source or shared in an archive.

## Verification

```text
npm run lint
npm run build
npm audit --omit=dev
```

## Production notes

The included `api` entry points allow Vercel to run the Express routes while Vite serves the frontend. Set `GROQ_API_KEY` in the hosting provider's server environment.

Local knowledge uploads are stored on disk and use a small keyword match rather than a token-heavy vector pipeline. Serverless filesystems are not durable, so hosted uploads deliberately return a clear error instead of pretending to persist. Bundled or local documents can still be used without a paid service.

For GitHub/Vercel deployment, do not set `VITE_API_URL` to `localhost`; leave it empty so the browser calls the same-origin `/api` functions. Set only the server-side `GROQ_API_KEY` in Vercel. The free Groq quota is still a hard provider limit: no application code can guarantee unlimited simultaneous public usage on one free key.
