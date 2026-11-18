import assert from "node:assert/strict"
import { assertDurableRateLimitInput, getDurableRateLimitFailure, parseDurableRateLimitResult } from "../lib/server/security/rate-limit-contract.ts"

assertDurableRateLimitInput("user:123:transfer", 10, 60_000)
assert.throws(() => assertDurableRateLimitInput("", 10, 60_000), /INVALID_RATE_LIMIT_KEY/)
assert.throws(() => assertDurableRateLimitInput("x".repeat(513), 10, 60_000), /INVALID_RATE_LIMIT_KEY/)
for (const limit of [0, -1, 100_001, 1.5]) assert.throws(() => assertDurableRateLimitInput("k", limit, 60_000), /INVALID_RATE_LIMIT_CONFIGURATION/)
for (const windowMs of [0, 999, 86_400_001, 1.5]) assert.throws(() => assertDurableRateLimitInput("k", 1, windowMs), /INVALID_RATE_LIMIT_CONFIGURATION/)
assert.deepEqual(parseDurableRateLimitResult({ ok: true, remaining: 9 }), { ok: true, remaining: 9 })
assert.deepEqual(parseDurableRateLimitResult({ ok: false, retryAfterSec: 12 }), { ok: false, retryAfterSec: 12 })
assert.deepEqual(getDurableRateLimitFailure({ ok: false, retryAfterSec: 12 }), { status: 429, code: "RATE_LIMITED" })
assert.deepEqual(getDurableRateLimitFailure({ ok: false, retryAfterSec: 5, unavailable: true }), { status: 503, code: "RATE_LIMIT_UNAVAILABLE" })
for (const invalid of [null, [], "ok", { ok: "true", remaining: 1 }, { ok: true }, { ok: true, remaining: -1 }, { ok: true, remaining: 1.2 }, { ok: true, remaining: 100_001 }, { ok: false }, { ok: false, retryAfterSec: 0 }, { ok: false, retryAfterSec: 86_401 }, { ok: false, retryAfterSec: 1.5 }]) assert.equal(parseDurableRateLimitResult(invalid), null)
console.log("Pass 45 rate-limit contract behavior: PASS (input bounds and malformed RPC payload rejection and 429/503 failure mapping)")
