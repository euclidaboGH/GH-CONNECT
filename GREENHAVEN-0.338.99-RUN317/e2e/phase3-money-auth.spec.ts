/**
 * Phase 3 — money/auth structural journeys.
 * Does not require Pi credentials. Validates API contracts and unauthenticated denials.
 */
import { test, expect } from "@playwright/test"

test.describe("Phase 3 money/auth API contracts", () => {
  test("POST /api/payments/approve without body is rejected", async ({ request }) => {
    const res = await request.post("/api/payments/approve", {
      data: {},
      headers: { "Content-Type": "application/json" },
    })
    // 400 paymentId required, or 401/403/503 depending on deployment config — never 200
    expect(res.status()).not.toBe(200)
    expect([400, 401, 403, 503]).toContain(res.status())
    const body = await res.json().catch(() => ({}))
    expect(body.ok === false || body.error).toBeTruthy()
    // Must not leak operator secrets
    const text = JSON.stringify(body)
    expect(text).not.toMatch(/PI_API_KEY is not configured on the server/)
    expect(text).not.toMatch(/Set PI_API_KEY \(Secret\)/)
  })

  test("POST /api/payments/approve with fake paymentId does not return provider key hints", async ({
    request,
  }) => {
    const res = await request.post("/api/payments/approve", {
      data: { paymentId: "pay_test_phase3_invalid" },
      headers: { "Content-Type": "application/json" },
    })
    expect(res.status()).not.toBe(200)
    const body = await res.json().catch(() => ({}))
    const text = JSON.stringify(body)
    expect(text).not.toMatch(/Pi Developer Portal/)
    expect(text).not.toMatch(/belongs to a different app/)
    expect(body.error === "PURPOSE_MISMATCH" ? false : true).toBeTruthy()
  })

  test("POST /api/auth/logout is safe without session", async ({ request }) => {
    const res = await request.post("/api/auth/logout", {
      headers: { "Content-Type": "application/json" },
    })
    // 200 logged out (idempotent) or rate-limited — not 500
    expect([200, 204, 429, 503]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json().catch(() => ({}))
      // Prefer explicit ok shape when present
      if (typeof body.ok === "boolean") {
        expect(body.ok === true || body.loggedOut === true || body.error).toBeTruthy()
      }
    }
  })

  test("mutating API without origin is handled by middleware policy", async ({ request }) => {
    // Playwright request context is same-origin to baseURL; this asserts the route exists
    // and does not 500 on empty POST to a protected economy path.
    const res = await request.post("/api/economy/ledger/credit", {
      data: {},
      headers: { "Content-Type": "application/json" },
    })
    expect([401, 403, 400, 429, 503]).toContain(res.status())
    expect(res.status()).not.toBe(200)
  })

  test("GET /api/health still reports readiness shape", async ({ request }) => {
    const res = await request.get("/api/health")
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    expect(body).toHaveProperty("status")
  })
})
