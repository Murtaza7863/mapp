# mApp

Offline-first PWA for areas, follow-up threads, routines, and natural-language **Plot**.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Install via **Add to Home Screen** (Safari on iOS, Chrome on Android) for the full PWA experience.

## Plot

Type natural language on the home screen. Plot uses a **fast rules parser** first (instant preview), then optionally refines with an **on-device LLM** (WebGPU):

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
