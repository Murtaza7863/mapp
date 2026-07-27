# Plotline

Plot your day in plain English. An offline-first PWA for tasks, areas, and routines that installs like a native app and keeps your data on your device.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Install via **Add to Home Screen** (Safari on iOS, Chrome on Android) for the full PWA experience.

## Live demo

Temporary preview links from Cursor mobile are **not** a real deploy. They stop working when the session ends.

For a permanent URL, deploy `dist/` to Cloudflare Pages, Vercel, or Netlify (see Deploy below).

## Capture

Type natural language on the home screen. Plotline uses a **fast rules parser** first, then optionally refines with an **on-device model** (WebGPU):

1. **Rules** — handles dates, areas, follow-ups, comma lists, agentic structure (`ATLAS > Outreach > Sponsors > …`)
2. **LLM** — Llama 3.2 1B with JSON-schema output when rules need help (messy dumps, missing items)

No API key. Models download once and run locally.

```
email prof about extension tomorrow #work
```

```
just finished call with Acme Corp, follow up with them by friday for ATLAS
```

```
ATLAS > Outreach > Sponsors > email venue by monday
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
npm run preview    # preview production build
```

## Deploy

**Cloudflare Pages** (or any static host):

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Output directory | `dist` |

Optional env vars for push: `VITE_PUSH_API_URL`, `VITE_VAPID_PUBLIC_KEY`

## Install on iPhone

1. Open deployed URL in **Safari**
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
