# Sunni AI

Sunni AI is a React and Express knowledge assistant backed by Groq. It supports streamed answers, local chat history, optional Supabase sync, image OCR, and local document retrieval.

## What this repaired version changes

- Keeps Groq credentials out of the browser bundle and sends all model requests through the backend.
- Parses streamed events correctly even when JSON is split across network packets.
- Uses matching uploaded knowledge documents in answers and returns source filenames as citations.
- Treats uploaded documents as untrusted reference text, never as application instructions.
- Preserves chat history when a tab is hidden, refreshed, or closed.
- Debounces Supabase writes instead of writing the full conversation for every generated token.
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
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: enable remote chat sync. Without both, history remains local.
- `VITE_ADMIN_PASSCODE`: enables the local admin configuration screen. This is a convenience gate compiled into frontend code, not secure production authentication.
- `VITE_ENABLE_REMOTE_TELEMETRY=true`: explicitly opts into remote request diagnostics. It is off by default because prompts and responses may be sensitive.

Never commit `.env`. Rotate any provider key that was previously placed in browser source or shared in an archive.

## Verification

```text
npm run lint
npm run build
npm audit --omit=dev
```

## Production notes

The included `api` entry points allow Vercel to run the Express routes while Vite serves the frontend. Set `GROQ_API_KEY` in the hosting provider's server environment.

Local knowledge uploads are stored on disk. Serverless filesystems are not durable, so hosted knowledge uploads deliberately return a clear error until persistent object storage is connected. Supabase Storage, S3, or another object store is the recommended next step.

For a public multi-user deployment, replace the local admin passcode with real server-side authentication and add per-user Supabase Row Level Security policies before enabling remote sync or diagnostics.
