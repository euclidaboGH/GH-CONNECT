import { defineConfig, devices } from "@playwright/test"
import { resolveE2eBaseUrl } from "./lib/e2e/resolve-base-url.mjs"

const resolved = resolveE2eBaseUrl(process.env)
if (!resolved.ok) {
  console.warn("[playwright] " + resolved.error)
}

const baseURL = resolved.ok ? resolved.baseUrl : "http://127.0.0.1:9"
const isLocal = Boolean(resolved.ok && resolved.isLocal)

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],
  webServer:
    isLocal && process.env.GHC_E2E_START_SERVER === "1"
      ? {
          command: "npm run start",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        }
      : undefined,
})
