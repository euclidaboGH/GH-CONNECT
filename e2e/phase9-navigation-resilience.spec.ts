import { test, expect } from "@playwright/test"

/** Browser-level Phase 9 checks. These use public routes and never require a Pi session. */
test.describe("Phase 9 navigation and resilience", () => {
  test("connection loss and restoration are announced without reloading the page", async ({ page, context }) => {
    await page.goto("/terms", { waitUntil: "domcontentloaded" })
    await context.setOffline(true)
    await expect(page.getByRole("alert").filter({ hasText: /You’re offline|You are offline/i })).toBeVisible()

    await context.setOffline(false)
    await expect(page.getByRole("status").filter({ hasText: /Connection restored/i })).toBeVisible()
    await expect(page).toHaveURL(/\/terms(?:$|[?#])/)
  })

  for (const viewport of [
    { name: "compact phone", width: 320, height: 640 },
    { name: "large phone", width: 430, height: 932 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    test(`public route has no horizontal document overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto("/terms", { waitUntil: "domcontentloaded" })
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
      }))
      expect(dimensions.document, `document overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.viewport + 1)
    })
  }

  test("unknown route returns a recoverable response rather than a server failure", async ({ page }) => {
    const response = await page.goto("/__phase9-route-does-not-exist__", { waitUntil: "domcontentloaded" })
    expect(response, "browser should receive an HTTP response").not.toBeNull()
    expect(response!.status(), "unknown route must not 5xx").toBeLessThan(500)
  })
})
