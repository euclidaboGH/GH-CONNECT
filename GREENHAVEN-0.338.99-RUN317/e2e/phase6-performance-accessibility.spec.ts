import { test, expect } from "@playwright/test"

const PUBLIC_ROUTE = "/terms"

test.describe("Phase 6 performance and accessibility acceptance", () => {
  test("public shell honours reduced-motion and remains within narrow viewports", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    for (const width of [320, 360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      const response = await page.goto(PUBLIC_ROUTE, { waitUntil: "domcontentloaded" })
      expect(response, `missing document response at ${width}px`).toBeTruthy()
      expect(response!.status()).toBeLessThan(500)
      const result = await page.evaluate(() => ({
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        language: document.documentElement.lang,
      }))
      expect(result.reducedMotion).toBe(true)
      expect(result.document, `document overflow at ${width}px`).toBeLessThanOrEqual(result.viewport + 1)
      expect(result.body, `body overflow at ${width}px`).toBeLessThanOrEqual(result.viewport + 1)
      expect(result.language.length).toBeGreaterThan(0)
    }
  })

  test("keyboard focus can move through public navigation without trapping", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const response = await page.goto(PUBLIC_ROUTE, { waitUntil: "domcontentloaded" })
    expect(response).toBeTruthy()
    await page.keyboard.press("Tab")
    const focused = await page.evaluate(() => {
      const active = document.activeElement
      if (!active) return null
      const rect = active.getBoundingClientRect()
      return { tag: active.tagName, visible: rect.width > 0 && rect.height > 0, disabled: (active as HTMLButtonElement).disabled === true }
    })
    expect(focused).toBeTruthy()
    expect(focused!.visible).toBe(true)
    expect(focused!.disabled).toBe(false)
  })

  test("offline and reconnect states are announced to assistive technology", async ({ page, context }) => {
    const response = await page.goto(PUBLIC_ROUTE, { waitUntil: "domcontentloaded" })
    expect(response).toBeTruthy()
    await context.setOffline(true)
    await expect(page.getByRole("alert").filter({ hasText: /you’re offline/i })).toBeVisible({ timeout: 8_000 })
    await context.setOffline(false)
    await expect(page.getByRole("status").filter({ hasText: /connection restored/i })).toBeVisible({ timeout: 8_000 })
  })
})
