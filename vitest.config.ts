import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    // The push worker targets the Workers runtime and has its own suite.
    exclude: ["**/node_modules/**", "**/smoke.test.ts", "worker/**"],
  },
});
