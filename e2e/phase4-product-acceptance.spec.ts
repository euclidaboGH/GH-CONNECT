import { test, expect, type BrowserContext } from "@playwright/test"
import { resolveE2eBaseUrl } from "../lib/e2e/resolve-base-url.mjs"

/**
 * Phase 4 product acceptance across the eleven core GreenHaven surfaces.
 * Requires real Testnet/Preview sessions; no fabricated balances, identities,
 * listings, messages, rewards, media, or payment state are used.
 */
const enabled = process.env.GHC_E2E_PHASE4 === "1"
const allowTestnet = process.env.GHC_E2E_ALLOW_TESTNET === "1"
const cookieA = String(process.env.GHC_E2E_COOKIE_A || "").trim()
const cookieB = String(process.env.GHC_E2E_COOKIE_B || "").trim()

const surfaces = [
  ["Feed", "/api/social/feed?limit=10", "protected"],
  ["Discover", "/api/social/people/discover?limit=10", "protected"],
  ["Profiles", "/api/profile/me", "protected"],
  ["Messages", "/api/messaging/conversations?limit=10", "protected"],
  ["Communities", "/api/communities?limit=10", "public"],
  ["Marketplace", "/api/marketplace/orders?limit=10", "protected"],
  ["Wallet", "/api/economy/wallet/summary", "protected"],
  ["Rewards", "/api/economy/rewards/daily", "protected"],
  ["Membership", "/api/membership/status", "protected"],
  ["Notifications", "/api/notifications?limit=10", "protected"],
  ["Media", "/api/media/health", "protected"],
] as const

function sessionCookie(raw: string) {
  const part = raw.split(";").map(value => value.trim()).find(value => value.startsWith("gh_session="))
  return part ? part.slice("gh_session=".length) : raw
}

async function installSession(context: BrowserContext, baseUrl: string, raw: string) {
  await context.addCookies([{
    name: "gh_session",
    value: sessionCookie(raw),
    url: baseUrl,
    httpOnly: true,
    secure: baseUrl.startsWith("https:"),
    sameSite: "Lax",
  }])
}

test.describe("Phase 4 — authenticated product acceptance", () => {
  test.beforeEach(() => {
    test.skip(!enabled || !allowTestnet, "Set GHC_E2E_PHASE4=1 and GHC_E2E_ALLOW_TESTNET=1")
    const target = resolveE2eBaseUrl(process.env)
    test.skip(!target.ok || target.isProdTarget, "Phase 4 acceptance refuses Production targets")
    test.skip(process.env.PI_NETWORK !== "testnet" || process.env.NEXT_PUBLIC_PI_SANDBOX !== "true", "Requires Preview Pi Testnet environment")
  })

  test("all core surfaces return authoritative success or an explicit degraded response", async ({ page, context }) => {
    test.skip(!cookieA, "Requires a real authenticated Testnet account in GHC_E2E_COOKIE_A")
    const target = resolveE2eBaseUrl(process.env)
    if (!target.ok) return
    await installSession(context, target.baseUrl, cookieA)

    const shell = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(shell, "app shell response").toBeTruthy()
    expect(shell!.status()).toBeLessThan(500)
    await expect(page.locator("body")).toBeVisible()

    const observed: Array<{ surface: string; status: number }> = []
    for (const [surface, endpoint] of surfaces) {
      const response = await page.request.get(endpoint, { timeout: 20_000 })
      observed.push({ surface, status: response.status() })
      expect([200, 409, 429, 503], `${surface} returned ${response.status()}`).toContain(response.status())
      expect(response.status()).not.toBe(500)
      const bodyText = await response.text()
      expect(bodyText).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY|PI_API_KEY|Bearer\s+[A-Za-z0-9._-]{24,}/i)
      if (response.status() === 503) {
        expect(bodyText).toMatch(/error|unavailable|disabled|temporarily|migration/i)
      }
    }
    expect(observed).toHaveLength(surfaces.length)
  })

  test("account identity is isolated between two real Testnet users", async ({ context }) => {
    test.skip(!cookieA || !cookieB, "Requires two real authenticated Testnet accounts in GHC_E2E_COOKIE_A and GHC_E2E_COOKIE_B")
    const target = resolveE2eBaseUrl(process.env)
    if (!target.ok) return

    await installSession(context, target.baseUrl, cookieA)
    const a = await context.request.get(new URL("/api/profile/me", target.baseUrl).toString(), { timeout: 15_000 })
    expect(a.status()).toBe(200)
    const aBody = await a.json()
    const aId = String(aBody?.profile?.id || aBody?.profile?.ghUserId || aBody?.user?.id || "")
    expect(aId.length).toBeGreaterThan(0)

    // Use a separate isolated browser context for account B; never overwrite A's cookie jar.
    const browser = context.browser()
    expect(browser).toBeTruthy()
    const contextB = await browser!.newContext()
    try {
      await installSession(contextB, target.baseUrl, cookieB)
      const b = await contextB.request.get(`${target.baseUrl}/api/profile/me`, { timeout: 15_000 })
      expect(b.status()).toBe(200)
      const bBody = await b.json()
      const bId = String(bBody?.profile?.id || bBody?.profile?.ghUserId || bBody?.user?.id || "")
      expect(bId.length).toBeGreaterThan(0)
      expect(bId).not.toBe(aId)

      const walletB = await contextB.request.get(`${target.baseUrl}/api/economy/wallet/summary`, { timeout: 15_000 })
      expect([200, 503]).toContain(walletB.status())
      const walletBody = await walletB.text()
      expect(walletBody).not.toContain(aId)
    } finally {
      await contextB.close()
    }
  })

  test("anonymous access is limited to intentionally public product data", async ({ request }) => {
    for (const [surface, endpoint, access] of surfaces) {
      const response = await request.get(endpoint, { timeout: 15_000 })
      if (access === "public") {
        expect([200, 503], `${surface} public status=${response.status()}`).toContain(response.status())
        const bodyText = await response.text()
        expect(bodyText).not.toMatch(/piAppUid|walletBalance|service_role|SUPABASE_SERVICE_ROLE_KEY|PI_API_KEY/i)
      } else {
        expect([401, 403, 429, 503], `${surface} anonymous status=${response.status()}`).toContain(response.status())
        expect(response.status()).not.toBe(200)
      }
    }
  })
})
