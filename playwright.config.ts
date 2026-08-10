import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  // The Next development server is intentionally shared by all browser tests.
  // Serial execution prevents concurrent on-demand route compilation from
  // aborting otherwise healthy Edge navigations on this Windows workspace.
  workers: 1,
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "msedge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
  ],
  webServer: {
    command: "corepack pnpm exec next dev -p 3000",
    url: baseURL,
    reuseExistingServer: true,
  },
});
