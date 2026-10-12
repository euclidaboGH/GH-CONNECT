/**
 * Section C static gates — economy/wallet/rewards (server authority).
 */
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const root = process.cwd()
const fails = []
const read = (rel) => {
  const p = join(root, rel)
  if (!existsSync(p)) {
    fails.push(`missing ${rel}`)
    return ""
  }
  return readFileSync(p, "utf8")
}

const daily = read("app/api/economy/rewards/daily/route.ts")
if (!daily.includes("export async function GET")) {
  fails.push("daily route must expose GET status (no mint)")
}
if (!daily.includes("alreadyClaimed") || !daily.includes("canClaimToday")) {
  fails.push("GET daily status must return alreadyClaimed / canClaimToday")
}
if (!daily.includes("void body.amount") && !daily.includes("void body.ghc")) {
  fails.push("POST daily must ignore client amounts")
}
if (!daily.includes("idempotencyKey")) {
  fails.push("daily claim must use idempotencyKey")
}

const transfers = read("app/api/economy/transfers/route.ts")
if (!transfers.includes("requireRecentStepUp")) fails.push("transfers need step-up")
if (!transfers.includes("referenceId")) {
  fails.push("transfers must require referenceId for dedupe/idempotency")
}

const membership = read("app/api/membership/activate/route.ts")
if (!membership.includes("requireRecentStepUp")) fails.push("membership activate needs step-up")

const claim = read("app/api/economy/rewards/claim/route.ts")
if (!claim.includes("alreadyClaimed") && !claim.includes("idempotencyKey")) {
  fails.push("pending claim path should surface alreadyClaimed / idempotency")
}

if (!existsSync(join(root, "app/api/economy/wallet/export/route.ts"))) {
  fails.push("wallet export route missing")
}
if (!existsSync(join(root, "app/api/economy/rewards/holds/route.ts"))) {
  fails.push("reward holds route expected")
}
if (!existsSync(join(root, "app/api/economy/rewards/appeals/route.ts"))) {
  fails.push("reward appeals route expected")
}

const wallet = read("features/wallet/wallet-screen.tsx")
if (wallet && !/pending/i.test(wallet)) fails.push("wallet should surface pending state")
if (wallet && !/Pending|available|spendable/i.test(wallet)) {
  fails.push("wallet should communicate pending vs available")
}

if (fails.length) {
  console.error("test-economy-cd-static FAILED")
  fails.forEach((f) => console.error(" -", f))
  process.exit(1)
}
console.log("test-economy-cd-static: PASS")
