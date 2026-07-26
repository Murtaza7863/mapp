# mApp

**A new way to stay organised.**

mApp maps your life into areas, tasks, threads, and routines — in one mobile-first command center. Install it on your Home Screen, use it offline, and keep your data on your device.

## What it is

Not a generic todo list. mApp is built for real workflows:

- **Command center** — overdue, today, threads that need a nudge, event prep deadlines
- **Areas** — organise work and life with folders and optional subgroups
- **Threads** — follow-up pipelines with quick actions (sent, waiting, your turn)
- **Offline-first** — tasks live in IndexedDB; auto-backup on device; export anytime

## Tech

- React + Vite PWA (installable on iPhone/Android)
- IndexedDB via Dexie — no account, no cloud database for your tasks
- Optional Web Push via Cloudflare Worker (notifications only; data stays local)

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. For the real experience, deploy to HTTPS and **Add to Home Screen** on your phone.

## Testing

```bash
npm test           # unit tests
npm run test:smoke # requires: npm run preview (port 4173)
npm run build
npm run lint
```

## Deploy

See [Push notifications](#push-notifications) below for the optional Cloudflare Worker. Frontend deploys to Cloudflare Pages (or any static host):

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Env vars:** `VITE_PUSH_API_URL`, `VITE_VAPID_PUBLIC_KEY` (optional, for push)

## Install on iPhone

1. Open the deployed URL in **Safari**
2. Share → **Add to Home Screen**
3. Launch from the Home Screen icon (not Safari)
4. Settings → enable notifications if you deployed push

## Push notifications

iOS requires a small server to fire scheduled pushes. The included `worker/` is a Cloudflare Worker that only stores your push subscription and notification schedule — **not your tasks**.

```bash
cd worker
npm install
npx web-push generate-vapid-keys
# Configure wrangler.toml + secrets, then npm run deploy
```

## Project structure

```
mapp/
├── src/     # React app
├── public/  # PWA assets
├── worker/  # Push scheduler (optional)
└── dist/    # Production build
```

## License

Private personal use.
