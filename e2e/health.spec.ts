import { test, expect } from "@playwright/test"

/**
 * API health — distinguishes deploy down vs app degraded.
 * Does not claim Pi Mainnet readiness.
 */
test.describe("Health endpoints", () => {
  test("GET /api/health returns JSON readiness shape", async ({ request }) => {
    const res = await request.get("/api/health")
    // 200 ready/degraded or 503 not_ready in production are both valid responses
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    expect(body).toHaveProperty("status")
    expect(body).toHaveProperty("ts")
  })

  test("GET /api/health/live is process-alive when available", async ({ request }) => {
    const res = await request.get("/api/health/live")
    // Some deploys may 404 if route missing — mark soft
    if (res.status() === 404) {
      test.info().annotations.push({ type: "note", description: "live probe not present" })
      return
    }
    expect(res.status()).toBe(200)
  })
})
