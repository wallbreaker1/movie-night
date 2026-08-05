# 🎬 Movie Night

A Next.js app for watching movies in sync, in real time, with friends. The video
is hosted on Cloudflare R2, play/pause/seek synchronization goes through Pusher
Channels, and the shared "room" state is kept in Upstash Redis. Simple
authentication: two hardcoded passwords (via environment variables).
`APP_PASSWORD_1` is the **host** (master) with full playback control;
`APP_PASSWORD_2` is a **guest** who watches in sync but can't control playback.

## How it works

- **Authentication** — the [/login](app/login/page.tsx) page checks the entered
  password against `APP_PASSWORD_1` / `APP_PASSWORD_2`. Whichever one matches
  determines the session's role: `APP_PASSWORD_1` grants the host role
  (`isHost: true`), `APP_PASSWORD_2` grants the guest role (`isHost: false`).
  On success, a signed httpOnly cookie is issued (JWT, via
  [`jose`](https://github.com/panva/jose)) carrying this role, valid for 30
  days. [proxy.ts](proxy.ts) protects the rest of the routes;
  [/api/state](app/api/state/route.ts) additionally rejects any mutating
  request from a non-host session with 403, so the restriction can't be
  bypassed by tampering with the client.
- **Player** — [components/VideoPlayer.tsx](components/VideoPlayer.tsx) is a
  custom video player (play/pause, ±10s, volume, progress, fullscreen, keyboard
  shortcuts, subtitles).
- **Realtime sync** — any action (play/pause/seek/movie change) is sent to
  [/api/state](app/api/state/route.ts), which updates the state in Redis and
  publishes the event on the Pusher channel `presence-movie-room`. All other
  clients receive the event and align their local player (with drift
  tolerance). When joining the room, each client fetches the current state from
  `/api/state` (GET), so anyone joining later sees the movie at the correct
  position.
- **Video from R2** — the `src` of the `<video>` element is simply the public
  R2 URL (public bucket or custom domain), so it natively supports HTTP Range
  requests (required for seek/scrubbing) with no proxy needed.

## Setup

### 1. Cloudflare R2

1. Create an R2 bucket and upload the video files (mp4 recommended, H.264/AAC
   for maximum browser compatibility).
2. Enable public access for the bucket (either the `pub-xxxx.r2.dev` domain, or
   a custom domain connected to the bucket from the Cloudflare dashboard).
3. Create an R2 API token with **Object Read** permission and add its Account ID,
   Access Key ID and Secret Access Key to the environment variables below.
4. Add videos to the bucket. The host playlist discovers them automatically
   every 30 seconds; `MOVIES_JSON` is only used as a fallback.

> If you want the video links to not be guessable, use hard-to-guess file names
> (UUID). Anyone who knows the direct URL can access the file without a
> password — this is an explicitly accepted trade-off, given that the app has
> no economic value.

### 2. Pusher Channels (realtime sync)

1. Free account on [dashboard.pusher.com](https://dashboard.pusher.com) →
   **Channels** → Create app.
2. From the **App Keys** tab, grab: `app_id`, `key`, `secret`, `cluster`.
3. Set in `.env.local`: `PUSHER_APP_ID`, `NEXT_PUBLIC_PUSHER_KEY`,
   `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_CLUSTER`.

### 3. Upstash Redis (shared state)

1. Free account on [console.upstash.com](https://console.upstash.com) → create
   a Redis database (or add the Upstash integration directly from Vercel →
   Marketplace, which fills in the environment variables automatically).
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into
   `.env.local`.

### 4. Environment variables

Copy `.env.example` → `.env.local` and fill everything in:

```bash
cp .env.example .env.local
```

Generate a session secret:

```bash
openssl rand -base64 32
```

### 5. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to
`/login`.

## Deploy to Vercel

1. Push to GitHub, then import the project at [vercel.com/new](https://vercel.com/new).
2. Add all variables from `.env.example` under **Project Settings →
   Environment Variables** (same values as local, or different passwords for
   production).
3. Deploy. Verify Range requests: check in the browser that seeking triggers
   requests to R2 with status `206 Partial Content`.

## Notes on synchronization

- Only the **host** (`APP_PASSWORD_1`) can control playback (play/pause/seek/
  change movie); guests (`APP_PASSWORD_2`) watch in sync, read-only. This is
  enforced both in the UI (controls are disabled) and server-side (the
  `/api/state` endpoint rejects mutating requests from non-host sessions).
- Every 20 seconds of playback, the host sends a "heartbeat" with the current
  position, to correct drift during long sessions.
- The **Sync** button in the header forces a manual re-alignment with the
  server state, useful if someone experienced buffering.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
