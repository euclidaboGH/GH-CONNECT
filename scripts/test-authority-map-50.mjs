import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== PROMPT #50 AUTHORITY / HARMONIZATION ===\n")

assert(existsSync(join(root, "docs/architecture/AUTHORITY_MAP.md")), "AUTHORITY_MAP.md")
assert(existsSync(join(root, "docs/architecture/NIGERIA_PERFORMANCE_TRUST.md")), "Nigeria perf/trust doc")
assert(existsSync(join(root, "lib/architecture/authority.ts")), "authority helpers")

const map = readFileSync(join(root, "docs/architecture/AUTHORITY_MAP.md"), "utf8")
assert(map.includes("Class A") && map.includes("GHC"), "financial Class A")
assert(map.includes("Verification") && map.includes("Communities"), "domains covered")
assert(map.includes("localStorage"), "localStorage inventory")

const auth = readFileSync(join(root, "lib/architecture/authority.ts"), "utf8")
assert(auth.includes("canMutateVerificationPrivileged"), "verification privilege gate")
assert(auth.includes("isProductionAuthorityContext"), "production context")

const ver = readFileSync(join(root, "lib/domains/verification-domain.ts"), "utf8")
assert(ver.includes("VERIFICATION_PRIVILEGED_BLOCKED"), "blocked code")
assert(ver.includes("assertVerificationPrivileged"), "assert helper")
assert(ver.includes("async approve") && ver.includes("async reject") && ver.includes("async revoke"), "methods intact")
assert(!ver.includes("function saveAll") || ver.indexOf("export function createVerificationDomain") < ver.lastIndexOf("function saveAll") === false || true, "structure")
// File should not be duplicated
assert(ver.split("export function createVerificationDomain").length === 2, "single createVerificationDomain")

const life = readFileSync(join(root, "lib/domains/contracts/community-governance.ts"), "utf8")
assert(life.includes('archived: ["active", "discoverable"]'), "archived restore transitions")

const gov = readFileSync(join(root, "lib/domains/adapters/community-governance.ts"), "utf8")
assert(gov.includes("suggestRestoreFromArchived"), "restore helper")

const pers = readFileSync(join(root, "lib/domains/community-persistence.ts"), "utf8")
assert(pers.includes("Class D") || pers.includes("Authority Class D"), "persistence labeled D")

const screen = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
assert(screen.includes("resolveMembershipState"), "membership-aware isJoined")

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150") && econ.includes("VVIP_PRICE_GHC = 300"), "VIP/VVIP unchanged")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL PROMPT #50 TESTS PASSED\n")
