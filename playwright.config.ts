import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Local credentials for the live-tenant suites. Never commit this file.
// See e2e/README.md and .env.e2e.example.

const ENV_FILE = ".env.e2e.local";
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

const BASE_URL = process.env.E2E_BASE_URL || "https://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Live sign-in against a real tenant is slow; the offline suites are fast.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "e2e-report" }],
    // Says how much of the live suite skipped itself for want of credentials —
    // otherwise a run that contacted no provider at all still exits 0.
    ["./e2e/support/liveSummaryReporter.ts"],
  ],

  use: {
    baseURL: BASE_URL,
    // Without this, a locator action on an element that never appears waits
    // forever and burns the whole test budget instead of failing where it broke.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // the dev server runs with a self-signed certificate
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      // Compiles every route once before the parallel workers start; see
      // e2e/warmup.setup.ts.
      name: "warmup",
      testMatch: /warmup\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Everything that can be proven without contacting an identity provider.
      name: "offline",
      testMatch: /.*\.offline\.spec\.ts/,
      dependencies: ["warmup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Round trips against real Entra and Auth0 tenants. Specs skip themselves
      // when the matching credentials are absent.
      name: "live",
      testMatch: /.*\.live\.spec\.ts/,
      dependencies: ["warmup"],
      retries: 1,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Regenerates docs/screenshots. Skips itself unless E2E_CAPTURE is set, so
      // a plain `pnpm e2e` never rewrites the images; see e2e/screenshots.capture.ts.
      name: "screenshots",
      testMatch: /screenshots\.capture\.ts/,
      dependencies: ["warmup"],
      // the width every current screenshot was taken at
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
