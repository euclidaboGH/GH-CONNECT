/**
 * Prompt #36 — domain contracts + isolation smoke tests (no network).
 */
import { createRequire } from "module"
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

let passed = 0
let failed = 0
function assert(cond, msg) {
  if (cond) {
    passed++
    console.log("  ✓", msg)
  } else {
    failed++
    console.error("  ✗", msg)
  }
}

console.log("\n=== DOMAIN CONTRACTS (#36) ===\n")

// --- File presence ---
const required = [
  "lib/domains/contracts/types.ts",
  "lib/domains/contracts/identity.ts",
  "lib/domains/contracts/connections.ts",
  "lib/domains/contracts/discovery.ts",
  "lib/domains/contracts/feed.ts",
  "lib/domains/contracts/messaging.ts",
  "lib/domains/contracts/communities.ts",
  "lib/domains/contracts/activities.ts",
  "lib/domains/contracts/notifications.ts",
  "lib/domains/contracts/reputation.ts",
  "lib/domains/contracts/search.ts",
  "lib/domains/contracts/index.ts",
  "lib/domains/adapters/ghc-context-seams.ts",
  "components/ghc/home-command-centre.tsx",
]
for (const f of required) {
  assert(existsSync(join(root, f)), `exists ${f}`)
}

// --- Connection intents expanded ---
const intentsSrc = readFileSync(join(root, "lib/connection-intents.ts"), "utf8")
for (const id of ["professional", "learning", "volunteering", "events", "friendship", "mentorship"]) {
  assert(intentsSrc.includes(`id: "${id}"`), `intent option ${id}`)
}
assert(intentsSrc.includes("professional:"), "intent keyword professional")
assert(intentsSrc.includes("learning:"), "intent keyword learning")

// --- Reputation isolation ---
const rep = readFileSync(join(root, "lib/domains/contracts/reputation.ts"), "utf8")
assert(rep.includes("NOT convertible to GHC"), "reputation not convertible to GHC")
assert(rep.includes("REPUTATION_ISOLATION_NOTE"), "reputation isolation note")
assert(!rep.includes("creditBalance") && !rep.includes("debitGhc"), "reputation has no balance mutators")

// --- Discovery explainable reasons ---
const disc = readFileSync(join(root, "lib/domains/contracts/discovery.ts"), "utf8")
assert(disc.includes("buildExplainableReasons"), "buildExplainableReasons exported")
assert(disc.includes("You both enjoy"), "shared interest copy")
assert(disc.includes("no unexplained") || disc.includes("never a fabricated"), "no fake % scores")

// --- Protected financial domains listed ---
const idx = readFileSync(join(root, "lib/domains/contracts/index.ts"), "utf8")
assert(idx.includes("PROTECTED_FINANCIAL_DOMAINS"), "protected financial domains constant")
assert(idx.includes("economy") && idx.includes("payments_pi"), "economy + pi protected")

// --- Seams document extraction map ---
const seams = readFileSync(join(root, "lib/domains/adapters/ghc-context-seams.ts"), "utf8")
assert(seams.includes("GHC_CONTEXT_EXTRACTION_MAP"), "extraction map")
assert(seams.includes("economy_protected"), "economy protected in map")
assert(seams.includes("isDemoDataAllowed"), "demo isolation in discovery seam")
assert(seams.includes("demo-"), "strips demo ids")

// --- Home command centre uses seams, keeps daily reward ---
const home = readFileSync(join(root, "components/ghc/home-command-centre.tsx"), "utf8")
assert(home.includes("DailyRewardHomeExperience"), "daily reward preserved")
assert(home.includes("createIdentitySeam"), "identity seam")
assert(home.includes("createConnectionsSeam"), "connections seam")
assert(home.includes("isDemoDataAllowed"), "demo policy aware")
assert(home.includes("aria-label"), "accessible region labels")

// --- Nav shell still primary 5 ---
const app = readFileSync(join(root, "components/ghc/app.tsx"), "utf8")
assert(app.includes('id: "home"'), "nav home")
assert(app.includes('id: "discover"'), "nav discover")
assert(app.includes('id: "create"'), "nav create")
assert(app.includes('id: "messages"'), "nav messages")
assert(app.includes('id: "profile"'), "nav profile")

// --- Demo policy still present ---
const demo = readFileSync(join(root, "lib/demo-data-policy.ts"), "utf8")
assert(demo.includes("isDemoDataAllowed"), "demo policy intact")

// --- Financial constants untouched sample ---
const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "VIP 150 unchanged")
assert(econ.includes("VVIP_PRICE_GHC = 300"), "VVIP 300 unchanged")

console.log("\n=== RESULTS ===")
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
if (failed) process.exit(1)
console.log("ALL DOMAIN CONTRACT TESTS PASSED\n")
