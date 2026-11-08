import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(path, "utf8")
const shared = read("components/ghc/filtering/filter-summary.tsx")
const utils = read("lib/filtering/filter-utils.ts")
assert.match(shared, /aria-live="polite"/)
assert.match(shared, /aria-label=\{`Remove filter:/)
assert.match(shared, /onClearAll/)
assert.match(utils, /normalize\("NFKC"\)/)
assert.match(utils, /every\(\(token\)/)
assert.doesNotMatch(read("lib/search-utils.ts"), /Math\.random\(\)/)

const surfaces = [
  ["Feed", "components/ghc/enhanced-feed-screen.tsx"],
  ["Discovery", "components/ghc/discovery-grid-screen.tsx"],
  ["Marketplace", "components/ghc/marketplace-screen.tsx"],
  ["Wallet", "features/wallet/wallet-screen.tsx"],
  ["Messages", "components/ghc/message-screen.tsx"],
  ["Notifications", "components/ghc/notification-bell.tsx"],
]
for (const [name, path] of surfaces) {
  assert.match(read(path), /FilterSummary/, `${name} must use shared active filter summary`)
  console.log(`PASS ${name} uses shared filter summary`)
}
assert.match(read("components/ghc/enhanced-feed-screen.tsx"), /matchesFilterQuery/)
assert.match(read("components/ghc/discovery-grid-screen.tsx"), /matchesFilterQuery/)
assert.match(read("features/wallet/wallet-screen.tsx"), /matchesFilterQuery/)
assert.match(read("components/ghc/message-screen.tsx"), /matchesFilterQuery/)
assert.match(read("components/ghc/notification-bell.tsx"), /sessionStorage\.setItem\(`ghc\.notif\.focus:\$\{encodeURIComponent\(identityUserId\)\}`/)
console.log("Phase 10 filtering source contracts: 17/17 passed")
