import { test, expect } from "@playwright/test"

/**
 * Public routes that must not 500. Auth gates may redirect — not a failure.
 */
const PUBLIC_PATHS = ["/", "/terms", "/support", "/share"]

test.describe("Public navigation", () => {
  for (const path of PUBLIC_PATHS) {
    test(`GET ${path} does not 5xx`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" })
      if (!res) {
        test.skip(true, "no response (network)")
        return
      }
      expect(res.status(), `${path} status`).toBeLessThan(500)
    })
  }
})
