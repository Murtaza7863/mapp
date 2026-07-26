import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    exclude: ["**/node_modules/**", "**/smoke.test.ts"],
  },
});
