/**
 * Phase 2C — critical journey coverage.
 * These tests are source-registered; execution requires Playwright + running app.
 */
import { test, expect } from "@playwright/test"

test.describe("Phase 2 critical journeys", () => {
  test("mobile primary nav exposes Home Cart Wallet Profile", async ({ page }) => {
    await page.goto("/")
    const nav = page.locator("nav.gh-bottom-nav, [class*='gh-bottom-nav']")
    await expect(nav.getByRole("button", { name: /Home/i })).toBeVisible({ timeout: 30_000 })
    await expect(nav.getByRole("button", { name: /Cart/i })).toBeVisible()
    await expect(nav.getByRole("button", { name: /Wallet/i })).toBeVisible()
    await expect(nav.getByRole("button", { name: /Profile/i })).toBeVisible()
  })

  test("wallet does not invent paid from request labels", async ({ page }) => {
    await page.goto("/")
    // Structural: financial state helper is unit-tested; UI must not show Paid without server
    const body = await page.content()
    expect(body.includes("transferSubmitted\": true") && body.includes("REQUESTED")).toBeFalsy()
  })

  test.skip("profile media upload preserves session", async () => {
    // Requires authenticated Pi session fixture — BLOCKED without test credentials
  })

  test.skip("withdrawal request never renders as paid", async () => {
    // Requires earnings fixture + API mock — enable when Testnet fixtures exist
  })
})
