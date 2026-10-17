import { test, expect } from "@playwright/test"

/**
 * UI smoke — does not fake Pi login or balances.
 */
test.describe("Application smoke", () => {
  test("homepage loads without hard crash", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))

    const res = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(res, "navigation response").toBeTruthy()
    expect(res!.status()).toBeLessThan(500)

    // App shell should render something
    await expect(page.locator("body")).toBeVisible()
    // Soft: no uncaught page errors from our bundle (Pi SDK may warn)
    const critical = errors.filter(
      (m) => !/pi|sdk|minepi|network/i.test(m)
    )
    expect(critical, `page errors: ${critical.join("; ")}`).toEqual([])
  })

  test("mobile viewport homepage renders", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const res = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(res!.status()).toBeLessThan(500)
    await expect(page.locator("body")).toBeVisible()
  })
})
