import fs from "node:fs"

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const domain = read("lib/domains/membership-domain.ts")
const route = read("app/api/economy/account/route.ts")
const limiter = read("lib/server/security/user-rate-limit.ts")
const checks = [
  ["account anchor hydration uses the intended idempotent mutation endpoint", /fetch\("\/api\/economy\/account"/.test(domain) && /method:\s*"POST"/.test(domain)],
  ["account hydration submits a bounded empty hint instead of profile-controlled fields", /body:\s*JSON\.stringify\(\{\}\)/.test(domain)],
  ["account hydration sends same-origin credentials", /credentials:\s*"include"/.test(domain)],
  ["account hydration explicitly requests JSON", /Accept:\s*"application\/json"/.test(domain)],
  ["account hydration bypasses intermediary caches", /cache:\s*"no-store"/.test(domain)],
  ["account hydration has a bounded request timeout", /AbortSignal\.timeout\(ACCOUNT_ANCHOR_REQUEST_TIMEOUT_MS\)/.test(domain)],
  ["concurrent account hydration calls share one in-flight request", /accountAnchorInFlight\.get\(userId\)/.test(domain) && /accountAnchorInFlight\.set\(userId, request\)/.test(domain)],
  ["successful account anchors are memoized per browser session", /accountAnchorMemory\.get\(userId\)/.test(domain) && /rememberAccountAnchor\(userId, anchor\)/.test(domain)],
  ["account anchor memory is bounded", /accountAnchorMemory\.size >= 128/.test(domain)],
  ["unavailable account hydration uses a short negative cache", /ACCOUNT_ANCHOR_NEGATIVE_TTL_MS = 30_000/.test(domain)],
  ["only finite positive server timestamps are accepted", /Number\.isFinite\(anchor\) && anchor > 0/.test(domain)],
  ["cached account anchors reject zero, negative and non-finite timestamps", /Number\.isFinite\(v\) && v > 0/.test(domain)],
  ["server-confirmed anchor is persisted as a local offline fallback", /writeCachedAccountCreatedAt\(userId, anchor\)/.test(domain)],
  ["offline hydration falls back to the last cached anchor", /return cached/.test(domain)],
  ["account mutation POST remains durably rate-limited and fail-closed", /enforceUserMutationRateLimit\(auth\.userId, "economy\/account:POST", 12, 60_000, \{ failClosed: true \}\)/.test(route)],
  ["rate-limit responses include a standards-compatible Retry-After header", /"Retry-After": String\(result\.retryAfterSec\)/.test(limiter)],
]

let failed = 0
for (const [label, test] of checks) {
  const passed = Boolean(test)
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`)
  if (!passed) failed += 1
}
console.log(`Run #245 account hydration hardening: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exitCode = 1
