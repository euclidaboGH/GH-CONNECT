import { test, expect } from '@playwright/test'
import { resolveE2eBaseUrl } from '../lib/e2e/resolve-base-url.mjs'

const enabled = process.env.GHC_E2E_PI_TESTNET === '1'
const allow = process.env.GHC_E2E_ALLOW_TESTNET === '1'
const cookieA = String(process.env.GHC_E2E_COOKIE_A || '').trim()

// This suite is deliberately skipped unless an operator explicitly enables it.
// It never fabricates Pi authentication, balances, payments, or wallet state.
test.describe('Phase 42 Pi Testnet E2E', () => {
  test.beforeEach(() => {
    test.skip(!enabled || !allow, 'Set GHC_E2E_PI_TESTNET=1 and GHC_E2E_ALLOW_TESTNET=1')
    test.skip(!cookieA, 'Requires a real authenticated Testnet/Preview session cookie')
    const resolved = resolveE2eBaseUrl(process.env)
    test.skip(!resolved.ok || resolved.isProdTarget, 'Testnet E2E refuses production targets')
  })

  test('authenticated account reaches authoritative product surfaces', async ({ page, context }) => {
    const resolved = resolveE2eBaseUrl(process.env)
    if (!resolved.ok) return
    const cookiePart = cookieA.split(';').map((x) => x.trim()).find((x) => x.startsWith('gh_session='))
    const value = cookiePart ? cookiePart.slice('gh_session='.length) : cookieA
    await context.addCookies([{
      name: 'gh_session', value, url: resolved.baseUrl,
      httpOnly: true, secure: resolved.baseUrl.startsWith('https:'), sameSite: 'Lax',
    }])

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(response).toBeTruthy()
    expect(response!.status()).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()

    const apiChecks = [
      '/api/auth/session',
      '/api/profile/me',
      '/api/economy/wallet/summary',
      '/api/membership/status',
      '/api/notifications?limit=10',
    ]
    for (const endpoint of apiChecks) {
      const result = await page.request.get(endpoint)
      expect([200, 503], `${endpoint} should be available or explicitly degraded`).toContain(result.status())
    }
  })

  test('Pi payment lifecycle is not client-authorized by fake data', async ({ request }) => {
    const intent = await request.post('/api/payments/complete', {
      headers: { Cookie: cookieA, 'Content-Type': 'application/json' },
      data: { paymentId: 'PHASE42_FAKE_PAYMENT', txid: 'PHASE42_FAKE_TXID' },
    })
    expect([400, 404, 409, 401, 403, 503]).toContain(intent.status())
    expect(intent.status()).not.toBe(200)
  })
})
