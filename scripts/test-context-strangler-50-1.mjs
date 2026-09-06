import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed = 0, failed = 0
const assert = (c, m) => { if (c) { passed++; console.log("  ✓", m) } else { failed++; console.error("  ✗", m) } }

console.log("\n=== PROMPT #50.1 CONTEXT STRANGLER ===\n")

const files = [
  "contexts/identity-context.tsx",
  "contexts/domains/feed-provider.tsx",
  "contexts/domains/wallet-read-provider.tsx",
  "lib/domains/adapters/wallet-read-seam.ts",
  "lib/domains/adapters/ghc-context-seams.ts",
  "contexts/ghc-context.tsx",
  "docs/architecture/GHC_CONTEXT_DEPENDENCY_MAP.md",
  "docs/architecture/GHC_CONTEXT_MIGRATION_STATUS.md",
  "docs/architecture/LOCALSTORAGE_INVENTORY_50_1.md",
  "app/page.tsx",
]
for (const f of files) assert(existsSync(join(root, f)), `exists ${f}`)

const page = readFileSync(join(root, "app/page.tsx"), "utf8")
assert(page.includes("IdentityProvider") && page.includes("FeedProvider") && page.includes("WalletReadProvider"), "provider hierarchy")
assert(page.includes("GHCProvider"), "compatibility facade retained")
assert(page.indexOf("IdentityProvider") < page.indexOf("FeedProvider"), "Identity outside Feed")
const jsxStart = page.indexOf("return (")
assert(page.indexOf("<WalletReadProvider>", jsxStart) < page.indexOf("<GHCProvider>", jsxStart), "WalletRead outside GHC")

const id = readFileSync(join(root, "contexts/identity-context.tsx"), "utf8")
assert(id.includes("IdentityService") && id.includes("getProfileSnapshot"), "identity seam API")
assert(!/sendGhc|claimDaily|transferGhc|createPayment/.test(id), "identity has no GHC mutations")

const feed = readFileSync(join(root, "contexts/domains/feed-provider.tsx"), "utf8")
assert(feed.includes("createFeedSeam") && feed.includes("FeedProvider"), "feed seam")
assert(!/getWallet|sendGhc|claimDaily|ledger/.test(feed), "feed has no wallet/ledger")
assert(feed.includes("isDemoDataAllowed"), "demo isolation awareness")

const wallet = readFileSync(join(root, "lib/domains/adapters/wallet-read-seam.ts"), "utf8")
assert(wallet.includes("readWalletSnapshot") && wallet.includes("WALLET_READ_SEAM_MUTATIONS"), "wallet read seam")
assert(wallet.includes("transfer: false") && wallet.includes("claim: false"), "mutations denied")
assert(wallet.includes("getBoundDomainServices"), "reads bound economy only")
// Comments may mention localStorage prohibition; ensure no getItem/setItem balance authority
assert(!/localStorage\.(get|set)Item/.test(wallet), "no localStorage balance authority")

const wrp = readFileSync(join(root, "contexts/domains/wallet-read-provider.tsx"), "utf8")
assert(wrp.includes("canMutateFinances: false"), "provider cannot mutate")
assert(!/sendGhc|executeTransfer|claimDaily/.test(wrp), "no write APIs")

const ghc = readFileSync(join(root, "contexts/ghc-context.tsx"), "utf8")
assert(ghc.includes("GHCProvider") && ghc.includes("useGHCFeed"), "legacy facade intact")

// Circular import heuristic
const feedImportsEconomy = /from ["']@\/lib\/domains\/economy/.test(feed)
const idImportsEconomy = /from ["']@\/lib\/server\/economy/.test(id)
assert(!feedImportsEconomy, "feed does not import economy domain")
assert(!idImportsEconomy, "identity does not import server economy")

const econ = readFileSync(join(root, "lib/server/economy/economic-config.ts"), "utf8")
assert(econ.includes("VIP_PRICE_GHC = 150") && econ.includes("VVIP_PRICE_GHC = 300"), "VIP/VVIP unchanged")

const map = readFileSync(join(root, "docs/architecture/GHC_CONTEXT_DEPENDENCY_MAP.md"), "utf8")
assert(map.includes("IDENTITY") && map.includes("FEED") && map.includes("GHC"), "dependency map domains")

console.log("\n=== RESULTS ===\nPassed:", passed, "\nFailed:", failed)
if (failed) process.exit(1)
console.log("ALL #50.1 STRANGLER TESTS PASSED\n")
