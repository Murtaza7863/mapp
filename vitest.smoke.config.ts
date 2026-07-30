import { defineConfig } from "vitest/config";

/**
 * Smoke tests hit a running `vite preview`, so they are excluded from the
 * default unit run and need their own config to be selectable at all.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/smoke.test.ts"],
  },
});
