# 🎬 Movie Night

Aplicație Next.js pentru vizionare sincronizată de filme, în timp real, alături de
prieteni. Video-ul este stocat în Cloudflare R2, sincronizarea play/pause/seek se
face prin Pusher Channels, iar starea partajată a "camerei" e ținută în Upstash
Redis. Autentificare simplistă: două parole hardcodate (prin variabile de mediu),
oricare dintre ele oferă acces complet.

## Cum funcționează

- **Autentificare** — pagina [/login](app/login/page.tsx) verifică parola introdusă
  împotriva `APP_PASSWORD_1` / `APP_PASSWORD_2`. La succes se emite un cookie
  httpOnly semnat (JWT, via [`jose`](https://github.com/panva/jose)) valabil 30 zile.
  [middleware.ts](middleware.ts) protejează restul rutelor.
- **Player** — [components/VideoPlayer.tsx](components/VideoPlayer.tsx) e un player
  video custom (play/pause, ±10s, volum, progres, fullscreen, scurtături de tastatură).
- **Sincronizare realtime** — orice acțiune (play/pause/seek/schimbare film) e trimisă
  către [/api/state](app/api/state/route.ts), care actualizează starea în Redis și
  publică evenimentul pe canalul Pusher `presence-movie-room`. Toți ceilalți clienți
  primesc evenimentul și își aliniază player-ul local (cu toleranță de drift).
  La intrare în cameră, fiecare client preia starea curentă din `/api/state` (GET),
  astfel încât cine se alătură mai târziu vede filmul din poziția corectă.
- **Video din R2** — `src`-ul din `<video>` este pur și simplu URL-ul public din R2
  (bucket public sau custom domain), deci suportă nativ HTTP Range requests
  (necesare pentru seek/scrubbing) fără niciun proxy.

## Setup

### 1. Cloudflare R2

1. Creează un bucket R2 și încarcă fișierele video (mp4 recomandat, H.264/AAC pentru
   compatibilitate maximă în browser).
2. Activează acces public pentru bucket (fie domeniul `pub-xxxx.r2.dev`, fie un
   custom domain conectat la bucket din dashboard-ul Cloudflare).
3. Notează URL-urile publice ale fișierelor — le pui în `MOVIES_JSON`.

> Dacă vrei ca link-urile video să nu fie ghicibile, folosește nume de fișier greu
> de ghicit (UUID). Oricine cunoaște URL-ul direct poate accesa fișierul fără parolă
> — e o compromitere acceptată explicit, dat fiind că aplicația nu are valoare
> economică.

### 2. Pusher Channels (sincronizare realtime)

1. Cont gratuit pe [dashboard.pusher.com](https://dashboard.pusher.com) → **Channels** → Create app.
2. Din tab-ul **App Keys** iei: `app_id`, `key`, `secret`, `cluster`.
3. Pui în `.env.local`: `PUSHER_APP_ID`, `NEXT_PUBLIC_PUSHER_KEY`, `PUSHER_SECRET`,
   `NEXT_PUBLIC_PUSHER_CLUSTER`.

### 3. Upstash Redis (stare partajată)

1. Cont gratuit pe [console.upstash.com](https://console.upstash.com) → creează o
   bază Redis (sau adaugă integrarea Upstash direct din Vercel → Marketplace, care
   completează automat variabilele de mediu).
2. Copiază `UPSTASH_REDIS_REST_URL` și `UPSTASH_REDIS_REST_TOKEN` în `.env.local`.

### 4. Variabile de mediu

Copiază `.env.example` → `.env.local` și completează tot:

```bash
cp .env.example .env.local
```

Generează un secret de sesiune:

```bash
openssl rand -base64 32
```

### 5. Rulare locală

```bash
npm install
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000) — vei fi redirecționat spre
`/login`.

## Deploy pe Vercel

1. Push pe GitHub, apoi importă proiectul în [vercel.com/new](https://vercel.com/new).
2. Adaugă în **Project Settings → Environment Variables** toate variabilele din
   `.env.example` (aceleași valori ca local, sau parole diferite pentru producție).
3. Deploy. Verifică Range requests: caută în browser la seek dacă cererile către
   R2 au status `206 Partial Content`.

## Note despre sincronizare

- Oricine e autentificat poate controla playback-ul (nu există rol separat de
  „host"); ultima acțiune câștigă și e propagată la toți.
- La fiecare 20 de secunde de playback, clientul activ trimite un „heartbeat" cu
  poziția curentă, ca să corecteze drift-ul pe sesiuni lungi.
- Butonul **Sincronizează** din header forțează re-alinierea manuală cu starea din
  server, util dacă cineva a avut buffering.


Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
