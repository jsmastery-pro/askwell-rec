import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Booting pglite takes a few seconds.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
