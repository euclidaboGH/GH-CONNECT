import fs from "node:fs"

const routes = [
  "app/api/payments/intents/route.ts",
  "app/api/social/blocks/route.ts",
  "app/api/social/mutes/route.ts",
  "app/api/auth/pi/route.ts",
  "app/api/economy/earnings/withdrawals/execute/route.ts",
  "app/api/economy/earnings/withdrawals/route.ts",
  "app/api/economy/transfers/route.ts",
  "app/api/economy/rewards/pi-cashback/claim/route.ts",
  "app/api/economy/rewards/claim/route.ts",
  "app/api/economy/rewards/daily/route.ts",
  "app/api/economy/rewards/claim-matured/route.ts",
  "app/api/economy/purchase-ghc/route.ts",
  "app/api/economy/ledger/spend/route.ts",
]
const failures = []
for (const file of routes) {
  const source = fs.readFileSync(file, "utf8")
  if (!source.includes("checkDurableRateLimit(")) failures.push(`${file}: durable limiter call missing`)
  if (!/onUnavailable\s*:\s*["\']deny["\']/.test(source)) failures.push(`${file}: durable limiter must fail closed`)
  if (!source.includes("durableRateLimitStatus(")) failures.push(`${file}: unavailable limiter must map to HTTP 503`)
  if (!source.includes("durableRateLimitCode(")) failures.push(`${file}: unavailable limiter must expose a distinct stable error code`)
}
const contract = fs.readFileSync("lib/server/security/rate-limit-contract.ts", "utf8")
const control = fs.readFileSync("lib/server/security/control-plane.ts", "utf8")
const css = fs.readFileSync("app/globals.css", "utf8")
const loading = fs.readFileSync("app/loading.tsx", "utf8")
const errorBoundary = fs.readFileSync("app/error.tsx", "utf8")
if (!contract.includes('status: unavailable ? 503 : 429')) failures.push("429/503 distinction missing from tested limiter contract")
if (!contract.includes('code: unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED"')) failures.push("stable limiter failure codes missing")
if (!control.includes('retryAfterSec: 5, unavailable: true')) failures.push("fail-closed sentinel must explicitly mark infrastructure unavailability")
if (!css.includes(":focus-visible") || !css.includes("prefers-reduced-motion") || !css.includes("gh-skeleton-shimmer")) failures.push("global keyboard, reduced-motion, or loading-state experience contract missing")
if (!loading.includes("gh-skeleton") || !loading.includes("aria-busy=\"true\"") || loading.includes("from-violet-600")) failures.push("root loading experience must use accessible GreenHaven skeleton treatment")
if (errorBoundary.includes("error?.message")) failures.push("raw exception messages must not be mirrored into browser console")
for (const rel of ["app/api/social/blocks/route.ts", "app/api/social/mutes/route.ts"]) {
  const source = fs.readFileSync(rel, "utf8")
  if (!/onUnavailable\s*:\s*["\']deny["\']/.test(source)) failures.push(`${rel}: social safety action must fail closed`)
}
if (failures.length) {
  console.error(`Pass 46 experience/fail-closed checks: ${failures.length} failure(s)`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log(`Pass 46 experience/fail-closed checks: PASS (${routes.length} durable API boundaries, 429/503 contract, accessible interaction baseline)`)
