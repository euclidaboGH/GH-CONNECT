import { test, expect, type Page, type Locator, type BrowserContext } from "@playwright/test"
import { resolveE2eBaseUrl } from "../lib/e2e/resolve-base-url.mjs"

const WIDTHS = [320, 360, 390, 768, 1024, 1440]
const HEIGHT = 900

async function assertNoDocumentOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      "img, video, canvas, input, textarea, select, button, a, [role='button'], h1, h2, h3, p, [data-post-id]",
    ))
    const overflow = candidates.flatMap((el) => {
      if (!el.getClientRects().length) return []
      if (el.closest("[role='tablist'], .overflow-x-auto, .overflow-x-scroll, [data-overflow-allow='true']")) return []
      if (el.closest("[aria-hidden='true'], [inert]")) return []
      let parent: HTMLElement | null = el
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent)
        if (style.display === "none" || style.visibility === "hidden" || style.contentVisibility === "hidden" || Number(style.opacity) === 0) return []
        parent = parent.parentElement
      }
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return []
      if (rect.left < -1 || rect.right > viewport + 1) {
        return [{ tag: el.tagName.toLowerCase(), label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60), left: Math.round(rect.left), right: Math.round(rect.right) }]
      }
      return []
    }).slice(0, 12)
    return {
      viewport,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      height: document.documentElement.clientHeight,
      overflow,
    }
  })
  expect(result.document, `${label}: document horizontal overflow`).toBeLessThanOrEqual(result.viewport + 1)
  expect(result.body, `${label}: body horizontal overflow`).toBeLessThanOrEqual(result.viewport + 1)
  expect(result.height).toBeGreaterThan(0)
  expect(result.overflow, `${label}: visible controls/content cross the viewport edge`).toEqual([])
}

async function screenshotIfVisible(page: Page, locator: Locator, path: string, testInfo: { outputPath: (name: string) => string }) {
  if (!(await locator.isVisible().catch(() => false))) return false
  await page.screenshot({ path: testInfo.outputPath(path), fullPage: false, animations: "disabled" })
  return true
}

async function clickIfVisible(locator: Locator) {
  if (!(await locator.isVisible().catch(() => false))) return false
  await locator.click()
  return true
}

async function seedPreviewQaSession(context: BrowserContext) {
  // Inject only an explicitly supplied QA session, never a made-up identity.
  // Production runs intentionally do not reuse a Preview/Testnet cookie.
  const cookieHeader = process.env.GHC_E2E_COOKIE_A?.trim()
  const resolved = resolveE2eBaseUrl(process.env)
  if (!cookieHeader || !resolved.ok || resolved.isProdTarget || process.env.GHC_E2E_TARGET === "production") return false

  const cookiePart = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith("gh_session="))
  const raw = cookiePart ? cookiePart.slice("gh_session=".length) : cookieHeader
  if (!raw || /[\r\n;]/.test(raw)) throw new Error("GHC_E2E_COOKIE_A must be a gh_session cookie value/header, not multiple cookie fields")

  await context.addCookies([{
    name: "gh_session",
    value: raw,
    url: resolved.baseUrl,
    httpOnly: true,
    secure: resolved.baseUrl.startsWith("https:"),
    sameSite: "Lax",
  }])
  return true
}

test.describe("Phase 24 rendered responsive screen review", () => {
  test("public entry renders and stays within the viewport at all target widths", async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT })
      const response = await page.goto("/", { waitUntil: "domcontentloaded" })
      expect(response, `no document response at ${width}px`).toBeTruthy()
      expect(response!.status(), `HTTP status at ${width}px`).toBeLessThan(500)
      await expect(page.locator("body")).toBeVisible()
      await assertNoDocumentOverflow(page, `public entry ${width}px`)
      await screenshotIfVisible(page, page.locator("body"), `entry-${width}x${HEIGHT}.png`, testInfo)
      const onboarding = page.getByRole("region", { name: "GreenHaven account setup" })
      await screenshotIfVisible(page, onboarding, `onboarding-${width}x${HEIGHT}.png`, testInfo)
    }
  })

  test("authenticated product surfaces render without viewport overflow", async ({ page }, testInfo) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await seedPreviewQaSession(page.context())
    const response = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(response).toBeTruthy()
    const navigation = page.getByRole("navigation", { name: "Main navigation" })
    if (!(await navigation.isVisible().catch(() => false))) {
      test.skip(true, "requires a real authenticated visual-QA session; this test does not fake Pi identity or financial data")
      return
    }

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT })
      const tabs = [
        { name: /Home, current tab|Go to Home/, landmark: page.getByRole("feed").first(), file: "feed" },
        { name: /Discover, current tab|Go to Discover/, landmark: page.getByRole("region", { name: "Discover people and communities" }), file: "discover" },
        { name: /Messages, current tab|Go to Messages/, landmark: page.getByRole("region", { name: /Messages inbox|Conversation thread/ }).first(), file: "messages" },
        { name: /Profile, current tab|Go to Profile/, landmark: page.getByRole("region", { name: "Your GreenHaven profile" }), file: "profile" },
      ]
      for (const tab of tabs) {
        const button = navigation.getByRole("button", { name: tab.name }).first()
        if (!(await button.isVisible().catch(() => false))) continue
        await button.click()
        await tab.landmark.waitFor({ state: "visible", timeout: 2_500 }).catch(() => {})
        await assertNoDocumentOverflow(page, `${tab.file} ${width}px`)
        await screenshotIfVisible(page, tab.landmark, `${tab.file}-${width}.png`, testInfo)
      }

      // Wallet and Settings are secondary full-screen surfaces reached from Profile.
      await clickIfVisible(navigation.getByRole("button", { name: /Profile, current tab|Go to Profile/ }).first())
      const walletButton = page.getByRole("button", { name: "Wallet", exact: true }).first()
      if (await clickIfVisible(walletButton)) {
        const wallet = page.getByRole("region", { name: "GHC wallet" })
        await wallet.waitFor({ state: "visible", timeout: 2_500 }).catch(() => {})
        if (await wallet.isVisible().catch(() => false)) {
          await assertNoDocumentOverflow(page, `wallet ${width}px`)
          await screenshotIfVisible(page, wallet, `wallet-${width}.png`, testInfo)
        }
        await clickIfVisible(page.getByRole("button", { name: "Back", exact: true }).first())
      }

      const settingsButton = page.getByRole("button", { name: "Settings", exact: true }).first()
      if (await clickIfVisible(settingsButton)) {
        const settings = page.getByRole("region", { name: "GreenHaven settings" })
        await settings.waitFor({ state: "visible", timeout: 2_500 }).catch(() => {})
        if (await settings.isVisible().catch(() => false)) {
          await assertNoDocumentOverflow(page, `settings ${width}px`)
          await screenshotIfVisible(page, settings, `settings-${width}.png`, testInfo)
        }
        await clickIfVisible(page.getByRole("button", { name: "Back to profile", exact: true }).first())
      }

      // Marketplace and Ecosystem are reached through the real shared surface actions.
      const marketplaceButton = page.getByRole("button", { name: "Open Marketplace", exact: true }).first()
      if (await clickIfVisible(marketplaceButton)) {
        const marketplace = page.getByRole("region", { name: "GreenHaven marketplace" })
        await marketplace.waitFor({ state: "visible", timeout: 2_500 }).catch(() => {})
        if (await marketplace.isVisible().catch(() => false)) {
          await assertNoDocumentOverflow(page, `marketplace ${width}px`)
          await screenshotIfVisible(page, marketplace, `marketplace-${width}.png`, testInfo)
        }
        await clickIfVisible(page.getByRole("button", { name: /Back to listings|Back/ }).first())
      }

      const ecosystemButton = page.getByRole("button", { name: "Open Ecosystem", exact: true }).first()
      if (await clickIfVisible(ecosystemButton)) {
        await page.getByText("GreenHaven Ecosystem", { exact: true }).waitFor({ state: "visible", timeout: 2_500 }).catch(() => {})
        await assertNoDocumentOverflow(page, `ecosystem ${width}px`)
        await screenshotIfVisible(page, page.getByText("GreenHaven Ecosystem", { exact: true }).first(), `ecosystem-${width}.png`, testInfo)
        const communityService = page.getByRole("button", { name: "Open Community", exact: true }).first()
        if (await clickIfVisible(communityService)) {
          const communities = page.getByRole("region", { name: "GreenHaven communities" })
          await communities.waitFor({ state: "visible", timeout: 2_500 }).catch(() => {})
          if (await communities.isVisible().catch(() => false)) {
            await assertNoDocumentOverflow(page, `communities ${width}px`)
            await screenshotIfVisible(page, communities, `communities-${width}.png`, testInfo)
          }
          await clickIfVisible(page.getByRole("button", { name: "Back", exact: true }).first())
        }
        await clickIfVisible(page.getByRole("button", { name: "Back", exact: true }).first())
      }
    }
  })
})

// Degraded-network and keyboard-open captures are deliberately unauthenticated:
// these tests verify the public shell without inventing a Pi identity or wallet state.
test.describe("Phase 24 responsive recovery states", () => {
  test("keyboard-open layouts keep focused onboarding controls visible", async ({ page }, testInfo) => {
    test.setTimeout(90_000)
    for (const size of [
      { width: 320, height: 640, label: "phone-320" },
      { width: 390, height: 844, label: "phone-390" },
      { width: 768, height: 900, label: "tablet-768" },
      { width: 1440, height: 900, label: "desktop-1440" },
    ]) {
      await page.setViewportSize({ width: size.width, height: size.height })
      const response = await page.goto("/", { waitUntil: "domcontentloaded" })
      expect(response, `no response at ${size.label}`).toBeTruthy()
      await expect(page.locator("body")).toBeVisible()

      const field = page.locator('input:not([type="hidden"]):visible, textarea:visible').first()
      if (!(await field.isVisible().catch(() => false))) {
        await screenshotIfVisible(page, page.locator("body"), `keyboard-no-field-${size.label}.png`, testInfo)
        continue
      }
      await field.focus()
      // Chromium cannot display the native Android keyboard. A reduced viewport
      // emulates the usable area after the keyboard opens; real Pi Browser QA remains required.
      if (size.width <= 768) {
        await page.setViewportSize({ width: size.width, height: Math.max(280, size.height - 300) })
      }
      await expect(field).toBeFocused()
      await expect(field).toBeVisible()
      const bounds = await field.boundingBox()
      expect(bounds, `focused field has no bounds at ${size.label}`).toBeTruthy()
      expect(bounds!.bottom).toBeLessThanOrEqual((await page.evaluate(() => window.innerHeight)) + 2)
      await assertNoDocumentOverflow(page, `keyboard-open ${size.label}`)
      await screenshotIfVisible(page, page.locator("body"), `keyboard-open-${size.label}.png`, testInfo)
    }
  })

  test("offline and API-failure states preserve the shell and allow a fresh-load recovery", async ({ page, context }, testInfo) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 390, height: 844 })
    const response = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(response).toBeTruthy()
    await expect(page.locator("body")).toBeVisible()

    await context.setOffline(true)
    await expect(page.locator("body")).toBeVisible()
    await screenshotIfVisible(page, page.locator("body"), "offline-existing-shell-390.png", testInfo)
    await context.setOffline(false)

    // Simulate an unavailable API without changing payment/provider data. This
    // verifies graceful shell rendering; endpoint-specific retry behavior must
    // be validated against a configured Preview/Testnet environment.
    await page.route("**/api/**", (route) => route.abort("failed"))
    const failedApiResponse = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(failedApiResponse, "document should remain available when API routes fail").toBeTruthy()
    await expect(page.locator("body")).toBeVisible()
    await assertNoDocumentOverflow(page, "API failure state")
    await screenshotIfVisible(page, page.locator("body"), "api-failure-shell-390.png", testInfo)

    await page.unroute("**/api/**")
    const recoveredResponse = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(recoveredResponse, "fresh navigation after restoring network should recover").toBeTruthy()
    expect(recoveredResponse!.status()).toBeLessThan(500)
    await expect(page.locator("body")).toBeVisible()
    await assertNoDocumentOverflow(page, "fresh-load recovery")
    await screenshotIfVisible(page, page.locator("body"), "fresh-load-recovery-390.png", testInfo)
  })

  test("delayed API responses do not blank the public entry shell", async ({ page }, testInfo) => {
    test.setTimeout(45_000)
    await page.setViewportSize({ width: 390, height: 844 })
    let delayedRequestSeen = false
    await page.route("**/api/**", async (route) => {
      delayedRequestSeen = true
      await new Promise((resolve) => setTimeout(resolve, 1_200))
      await route.continue()
    })
    const response = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(response).toBeTruthy()
    await expect(page.locator("body")).toBeVisible()
    await screenshotIfVisible(page, page.locator("body"), "delayed-api-loading-shell-390.png", testInfo)
    expect(await page.locator("body").innerText()).not.toHaveLength(0)
    // Some public deployments make no API calls until login; don't invent an
    // API dependency just to force a loading state.
    testInfo.annotations.push({
      type: "delayed-api-observation",
      description: delayedRequestSeen ? "At least one API request was delayed" : "No public-entry API request was issued before capture",
    })
  })
})
