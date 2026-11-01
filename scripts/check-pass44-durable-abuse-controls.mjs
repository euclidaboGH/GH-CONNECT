import fs from "node:fs"
import path from "node:path"

const routes = [
  "app/api/economy/transfers/route.ts",
  "app/api/economy/ledger/spend/route.ts",
  "app/api/economy/rewards/daily/route.ts",
  "app/api/economy/rewards/claim/route.ts",
  "app/api/economy/rewards/claim-matured/route.ts",
  "app/api/economy/rewards/pi-cashback/claim/route.ts",
  "app/api/economy/purchase-ghc/route.ts",
  "app/api/payments/intents/route.ts",
  "app/api/economy/earnings/withdrawals/route.ts",
  "app/api/economy/earnings/withdrawals/execute/route.ts",
]
const failures = []
for (const file of routes) {
  if (!fs.existsSync(file)) { failures.push(`${file}: route missing`); continue }
  const source = fs.readFileSync(file, "utf8")
  if (!source.includes('from "@/lib/server/security/control-plane"') || !source.includes("checkDurableRateLimit")) {
    failures.push(`${file}: durable control-plane limiter is not integrated`)
  }
  if (!/await\s+checkDurableRateLimit\(/.test(source)) failures.push(`${file}: limiter call must be awaited`)
  if (!/onUnavailable\s*:\s*["']deny["']/.test(source)) failures.push(`${file}: limiter must fail closed when durable storage is unavailable`)
  if (/\bcheckRateLimit\s*\(/.test(source)) failures.push(`${file}: local-only limiter remains on a protected financial route`)
}
const controlPlane = fs.readFileSync("lib/server/security/control-plane.ts", "utf8")
const migration = fs.readFileSync("supabase/migrations/20261023040002_gh_security_control_plane_v2.sql", "utf8")
if (!controlPlane.includes('options.onUnavailable === "deny"')) failures.push("control plane: fail-closed unavailable behavior missing")
if (!migration.includes("gh_security_rate_limit_consume") || !migration.includes("FOR UPDATE") && !migration.includes("ON CONFLICT")) {
  failures.push("security migration: durable atomic rate-limit RPC contract missing")
}
if (failures.length) {
  console.error(`Pass 44 durable abuse controls: ${failures.length} failure(s)`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log(`Pass 44 durable abuse controls: PASS (${routes.length} financial and payment routes use awaited fail-closed durable limits)`)
