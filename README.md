# Plotline

Plot your day in plain English. An offline-first PWA for tasks, areas, and routines that installs like a native app and keeps your data on your device.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Install via **Add to Home Screen** (Safari on iOS, Chrome on Android) for the full PWA experience.

## Live demo

**PWA:** https://murtaza7863.github.io/mapp/

Open that URL on your phone → Safari Share → **Add to Home Screen**. Launch from the home-screen icon for the full offline app.

Temporary Cursor preview links are not a real deploy — they stop when the session ends.

## Capture

Type natural language on the home screen. Plotline uses a **fast rules parser** first, then optionally refines with an **on-device model** (WebGPU).

Plot adds tasks **and** controls the app — complete, snooze, reschedule, open screens, and more — with a confirm sheet before anything saves.

```
email prof about extension tomorrow #work
```

```
done: pay rent
snooze dentist until friday
open calendar
```

```
Travel: pack bags friday #personal
```

## Tech

- React + Vite PWA
- IndexedDB (Dexie) — data stays on device
- Rules parser + optional on-device LLM (WebGPU, JSON-schema constrained) for Plot
- Optional Web Push via Cloudflare Worker (`worker/`)

The app makes no third-party network requests. Fonts are self-hosted in
`public/fonts/` with the `@font-face` rules in `src/fonts.css`, so typography is
identical offline and nothing is fetched from a CDN. To change families, pull
the Google Fonts CSS for the new stack, save the latin and latin-ext `woff2`
files into `public/fonts/`, and point `src/fonts.css` at the local paths.

## Scripts

```bash
npm test           # unit tests, including a boot test for every route
npm run build      # production build → dist/
npm run lint
npm run preview    # preview production build (LAN-reachable)
npm run test:smoke # checks the built output; needs `npm run preview` running

cd worker && npm test   # push worker, incl. the RFC 8291 test vector
```

## Deploy

Pushes to `main` deploy automatically to **GitHub Pages**.

| Host | Notes |
|------|--------|
| GitHub Pages | `BASE_PATH=/mapp/` via `.github/workflows/deploy-pages.yml` |
| Cloudflare Pages / Netlify / Vercel | Build `npm run build`, output `dist`, leave `BASE_PATH` unset (root `/`) |

Optional env vars for push: `VITE_PUSH_API_URL`, `VITE_VAPID_PUBLIC_KEY`

## Install on iPhone

1. Open https://murtaza7863.github.io/mapp/ in **Safari**
2. Share → **Add to Home Screen**
3. Launch from Home Screen (not Safari tabs)
4. Enable notifications in Settings — iOS only offers push to installed apps

You only add it to the Home Screen once. Later deploys arrive on their own; fully
close the app and reopen it to pick one up.

## Reminders (push worker)

Reminders need a server, because a web app cannot wake itself up at a given
time. On iPhone this is the only route: iOS delivers Web Push to installed Home
Screen apps on iOS 16.4+, and nothing else fires while the app is closed.

`worker/` is a Cloudflare Worker that stores your schedule and sends each
reminder at its due time. It runs comfortably inside the free tier. Until it is
deployed, Settings shows that reminders are off and the app works as a planner
you open yourself.

Messages are encrypted with the `aes128gcm` content coding of RFC 8291,
implemented in `worker/src/webpush/` and pinned to the specification's test
vector. Note that the WebCrypto push libraries on npm still emit the older
`aesgcm` coding, which Apple's push service rejects.

### One-time setup

```bash
cd worker
npm install

# 1. Generate a VAPID keypair. Keep the private JWK secret.
npm run keys

# 2. Sign in and create the store the worker keeps schedules in.
npx wrangler login
npx wrangler kv namespace create KV     # paste the id into wrangler.toml

# 3. Give the worker its keys.
npx wrangler secret put VAPID_PRIVATE_JWK   # the private JWK from step 1
npx wrangler secret put VAPID_PUBLIC_KEY    # the public key from step 1

# 4. Set VAPID_SUBJECT in wrangler.toml to your own mailto: address.
#    Apple returns 403 without a valid contact.

npm run deploy
```

Then point the app at the worker by adding two **repository variables** in
GitHub under Settings → Secrets and variables → Actions → Variables:

| Variable | Value |
|----------|-------|
| `VITE_PUSH_API_URL` | the deployed worker URL, e.g. `https://mapp-push.<subdomain>.workers.dev` |
| `VITE_VAPID_PUBLIC_KEY` | the public key from step 1 |

Both are public values baked into the client bundle. Only the private JWK is a
secret, and it never leaves the worker.

Push the change (or re-run the Pages workflow), then on your phone open
Settings → **Enable notifications** → **Send a test notification**.

### Checking it works

```bash
curl https://<your-worker-url>/health      # {"ok":true,"configured":true}
cd worker && npx wrangler tail             # live logs, including send failures
```

## License

[MIT](LICENSE)
