import { defineConfig, devices } from "@playwright/test";

// `pnpm e2e`: E2E_APP_URL=<app or preview URL> E2E_PUBLIC_KEY=<dev project key> pnpm e2e
// Not part of `pnpm test`, so other checks never need a browser.
const HOST_PORT = Number(process.env.E2E_HOST_PORT ?? 4173);
const HOST_URL = `http://127.0.0.1:${HOST_PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: HOST_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/host-server.mjs",
    url: `${HOST_URL}/health`,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
