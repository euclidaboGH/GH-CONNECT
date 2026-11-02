import { test, expect } from "@playwright/test"

/** Public, identity-free browser coverage for Phase 9 navigation and accessibility. */
test.describe("Phase 9 continuation 7 accessibility journeys", () => {
  test("unknown-route recovery places focus on the recovery link", async ({ page }) => {
    const response = await page.goto("/__phase9-continuation7-unknown-route__", { waitUntil: "domcontentloaded" })
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(500)
    const title = page.getByRole("heading", { name: /We couldn’t find that page/i })
    await expect(title).toBeVisible()
    const home = page.getByRole("link", { name: "Open GreenHaven" })
    await expect(home).toBeVisible()
    await expect(home).toBeFocused()
    await expect(page.getByRole("button", { name: "Go back" })).toBeVisible()
  })

  test("reduced-motion preference is applied without disabling essential navigation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/__phase9-continuation7-unknown-route__", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: /We couldn’t find that page/i })).toBeVisible()
    const preference = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)
    expect(preference).toBe(true)
    await expect(page.getByRole("link", { name: "Open GreenHaven" })).toBeEnabled()
  })

  test("public entry retains keyboard access and user zoom at phone and desktop sizes", async ({ page }) => {
    for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport)
      const response = await page.goto("/", { waitUntil: "domcontentloaded" })
      expect(response).not.toBeNull()
      expect(response!.status()).toBeLessThan(500)
      await expect(page.locator("body")).toBeVisible()
      const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content")
      expect(viewportMeta).toContain("width=device-width")
      expect(viewportMeta).not.toMatch(/user-scalable\s*=\s*no/i)
      await page.keyboard.press("Tab")
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        return Boolean(el && el !== document.body && el !== document.documentElement)
      })
      expect(focused, `keyboard focus should move at ${viewport.width}px`).toBe(true)
    }
  })
})
