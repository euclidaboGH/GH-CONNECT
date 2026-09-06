import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== STEP 2 TRUST AUTHORITY ===\n")

const files = [
  "lib/architecture/trust-authority.ts",
  "lib/domains/adapters/trust-display.ts",
  "app/api/verification/request/route.ts",
  "app/api/verification/review/route.ts",
  "docs/architecture/TRUST_AUTHORITY_STEP2.md",
  "lib/domains/reputation-domain.ts",
  "lib/domains/verification-domain.ts",
]
for (const f of files) assert(existsSync(join(root, f)), f)

const trust = readFileSync(join(root, "lib/architecture/trust-authority.ts"), "utf8")
assert(trust.includes("canShowVerifiedBadge") && trust.includes("canMutateReputationPrivileged"), "trust APIs")
assert(trust.includes("isTrustProductionMode"), "production mode")

const rep = readFileSync(join(root, "lib/domains/reputation-domain.ts"), "utf8")
assert(rep.includes("REPUTATION_PRIVILEGED_BLOCKED"), "delta override blocked")
assert(rep.includes("REPUTATION_CROSS_USER_BLOCKED"), "cross-user blocked")
assert(rep.includes("cannot be purchased with GHC") || rep.includes("Cannot be purchased"), "no GHC buy")

const ver = readFileSync(join(root, "lib/domains/verification-domain.ts"), "utf8")
assert(ver.includes("VERIFICATION_PRIVILEGED_BLOCKED") || ver.includes("assertVerificationPrivileged"), "verify privileged")
assert(ver.includes("canShowVerifiedBadge"), "badge uses trust helper")

const review = readFileSync(join(root, "app/api/verification/review/route.ts"), "utf8")
assert(review.includes("GHC_VERIFICATION_SERVER") && review.includes("unauthorized"), "review gated")
assert(!review.includes("NEXT_PUBLIC"), "no public secrets")

const req = readFileSync(join(root, "app/api/verification/request/route.ts"), "utf8")
assert(req.includes("pending") && req.includes("does not grant"), "request pending only")

const disp = readFileSync(join(root, "lib/domains/adapters/trust-display.ts"), "utf8")
assert(disp.includes("resolveReputationDisplay") && disp.includes("provisional"), "display adapter")

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150") && econ.includes("VVIP_PRICE_GHC = 300"), "economy frozen")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL STEP 2 TESTS PASSED\n")
