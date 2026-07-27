# Contributing

```bash
npm install
npm run dev
npm test
npm run build
```

## Layout

- `src/lib/` — pure logic (prefer adding tests here)
- `src/views/` — route screens
- `src/lib/brain-dump/` — Plot parsing pipeline
- `worker/` — optional push scheduler

## Plot fixtures

Add cases to `src/lib/brain-dump/plot-fixtures.ts` for regression coverage.

## PRs

`npm test && npm run build` must pass.
