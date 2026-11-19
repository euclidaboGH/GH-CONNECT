import { test, expect, type BrowserContext } from "@playwright/test"
import { resolveE2eBaseUrl } from "../lib/e2e/resolve-base-url.mjs"

/**
 * Phase 5 measured browser checks. This suite is opt-in and refuses Production.
 * It records measurements instead of pretending static source budgets are live
 * Core Web Vitals or heap measurements.
 */
const enabled = process.env.GHC_E2E_PHASE5 === "1"
const allowTestnet = process.env.GHC_E2E_ALLOW_TESTNET === "1"
const rawCookie = String(process.env.GHC_E2E_COOKIE_A || "").trim()

function cookieValue(raw: string) {
  const item = raw.split(";").map(value => value.trim()).find(value => value.startsWith("gh_session="))
  return item ? item.slice("gh_session=".length) : raw
}

async function addSession(context: BrowserContext, baseUrl: string) {
  if (!rawCookie) return
  await context.addCookies([{
    name: "gh_session",
    value: cookieValue(rawCookie),
    url: baseUrl,
    httpOnly: true,
    secure: baseUrl.startsWith("https:"),
    sameSite: "Lax",
  }])
}

test.describe("Phase 5 — mobile, loading, memory and concurrency measurements", () => {
  test.beforeEach(() => {
    test.skip(!enabled || !allowTestnet, "Set GHC_E2E_PHASE5=1 and GHC_E2E_ALLOW_TESTNET=1")
    const target = resolveE2eBaseUrl(process.env)
    test.skip(!target.ok || target.isProdTarget, "Phase 5 browser measurements refuse Production")
    test.skip(process.env.PI_NETWORK !== "testnet" || process.env.NEXT_PUBLIC_PI_SANDBOX !== "true", "Requires Preview Pi Testnet")
  })

  test("shell has no horizontal overflow at common phone, tablet and desktop widths", async ({ page, context }) => {
    const target = resolveE2eBaseUrl(process.env)
    test.skip(!target.ok, "Requires an explicit Preview Testnet URL")
    if (!target.ok) return
    await addSession(context, target.baseUrl)

    const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440]
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      const response = await page.goto("/", { waitUntil: "domcontentloaded" })
      expect(response, `shell response at ${width}px`).toBeTruthy()
      expect(response!.status(), `shell status at ${width}px`).toBeLessThan(500)
      await expect(page.locator("body")).toBeVisible()
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        bodyScroll: document.body.scrollWidth,
      }))
      expect(dimensions.scroll, `document overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport + 1)
      expect(dimensions.bodyScroll, `body overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport + 1)
    }
  })

  test("records navigation timing, resource weight, LCP and available JS heap", async ({ page, context }) => {
    const target = resolveE2eBaseUrl(process.env)
    test.skip(!target.ok, "Requires an explicit Preview Testnet URL")
    if (!target.ok) return
    await addSession(context, target.baseUrl)
    await page.addInitScript(() => {
      const w = window as Window & { __ghVitals?: Record<string, number> }
      w.__ghVitals = {}
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) w.__ghVitals!.lcp = entry.startTime
        }).observe({ type: "largest-contentful-paint", buffered: true })
      } catch { /* Browser does not expose LCP observer. */ }
    })
    const response = await page.goto("/", { waitUntil: "networkidle", timeout: 45_000 })
    expect(response).toBeTruthy()
    expect(response!.status()).toBeLessThan(500)
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
      const heap = (performance as Performance & { memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number } }).memory
      const vitals = (window as Window & { __ghVitals?: Record<string, number> }).__ghVitals || {}
      return {
        domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null,
        loadEventMs: nav?.loadEventEnd ?? null,
        transferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
        resourceCount: resources.length,
        lcpMs: vitals.lcp ?? null,
        usedJsHeapBytes: heap?.usedJSHeapSize ?? null,
        totalJsHeapBytes: heap?.totalJSHeapSize ?? null,
      }
    })
    console.log(`[phase5-browser-metrics] ${JSON.stringify(metrics)}`)
    expect(metrics.resourceCount).toBeGreaterThan(0)
    expect(metrics.domContentLoadedMs).not.toBeNull()
    expect(metrics.domContentLoadedMs!).toBeLessThan(20_000)
  })

  test("eight simultaneous feed reads do not produce server errors", async ({ page, context }) => {
    const target = resolveE2eBaseUrl(process.env)
    test.skip(!target.ok || !rawCookie, "Requires Preview Testnet and a real GHC_E2E_COOKIE_A")
    if (!target.ok) return
    await addSession(context, target.baseUrl)
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      page.request.get(new URL("/api/social/feed?limit=10", target.baseUrl).toString(), { timeout: 20_000 })
    ))
    const statuses = results.map(result => result.status())
    console.log(`[phase5-concurrency] statuses=${statuses.join(",")}`)
    for (const status of statuses) expect([200, 401, 403, 409, 429, 503]).toContain(status)
    expect(statuses).not.toContain(500)
    for (const result of results) {
      const body = await result.text()
      expect(body).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY|PI_API_KEY|Bearer\s+[A-Za-z0-9._-]{24,}/i)
    }
  })
})
