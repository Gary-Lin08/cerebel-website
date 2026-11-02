import { defineConfig, devices } from "@playwright/test";

// Two targets share one suite:
//   npm run test:e2e            builds nothing; serves dist/client with `vite preview` and fakes /api/*
//   BASE_URL=https://… test:e2e  runs the same checks against a deployment, with the real API
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const local = !process.env.BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/e2e/.report" }]],
  outputDir: "tests/e2e/.results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    // Chromium with the phone's viewport, touch and user agent: WebKit is not installed here.
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: local
    ? {
        command: "npx vite preview --port 4173 --host 127.0.0.1 --strictPort",
        url: "http://127.0.0.1:4173/",
        reuseExistingServer: true,
        timeout: 60_000,
      }
    : undefined,
});
