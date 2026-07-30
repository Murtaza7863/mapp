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
npm test           # unit tests
npm run build      # production build → dist/
npm run lint
npm run preview    # preview production build (LAN-reachable)
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
4. Enable notifications in Settings if push is configured

## Push worker

```bash
cd worker
npm install
npx web-push generate-vapid-keys
# Configure wrangler.toml, then npm run deploy
```

## License

[MIT](LICENSE)
