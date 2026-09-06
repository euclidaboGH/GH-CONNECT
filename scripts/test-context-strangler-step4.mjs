import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== STEP 4 CONTEXT STRANGLER ===\n")

const files = [
  "lib/domains/adapters/session-bootstrap.ts",
  "contexts/domains/connections-provider.tsx",
  "contexts/domains/discovery-provider.tsx",
  "contexts/domains/feed-provider.tsx",
  "contexts/domains/wallet-read-provider.tsx",
  "app/page.tsx",
  "docs/architecture/CONTEXT_STRANGLER_STEP4.md",
]
for (const f of files) assert(existsSync(join(root, f)), f)

const boot = readFileSync(join(root, "lib/domains/adapters/session-bootstrap.ts"), "utf8")
assert(boot.includes("bootstrapPosts") && boot.includes("isDemoDataAllowed"), "bootstrap gates")
assert(boot.includes("return []"), "explicit empty")

const page = readFileSync(join(root, "app/page.tsx"), "utf8")
assert(page.includes("ConnectionsProvider") && page.includes("DiscoveryProvider"), "providers wired")
assert(page.includes("IdentityProvider") && page.includes("GHCProvider"), "facade retained")
const jsx = page.indexOf("return (")
assert(page.indexOf("<ConnectionsProvider>", jsx) < page.indexOf("<DiscoveryProvider>", jsx), "Connections before Discovery")
assert(page.indexOf("<WalletReadProvider>", jsx) < page.indexOf("<GHCProvider>", jsx), "WalletRead before GHC")

const ghc = readFileSync(join(root, "contexts/ghc-context.tsx"), "utf8")
assert(ghc.includes("bootstrapPosts") && ghc.includes("session-bootstrap"), "context uses bootstrap")
// Load paths should not call seedPosts() directly
assert(!ghc.includes("seedPosts()"), "no direct seedPosts() in context")
assert(!ghc.includes("seedStories()"), "no direct seedStories() in context")

const conn = readFileSync(join(root, "contexts/domains/connections-provider.tsx"), "utf8")
assert(conn.includes("createConnectionsSeam") && !/sendGhc|claimDaily|ledger/.test(conn), "connections read-only")

const disc = readFileSync(join(root, "contexts/domains/discovery-provider.tsx"), "utf8")
assert(disc.includes("createDiscoverySeam") && disc.includes("isDemoDataAllowed"), "discovery seam")

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"), "economy frozen")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL STEP 4 TESTS PASSED\n")
