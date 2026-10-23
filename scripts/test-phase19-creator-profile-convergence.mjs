import fs from "node:fs"
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const creator = read("components/ghc/creator-studio-panel.tsx")
const store = read("lib/server/creator/store.ts")
const complete = read("app/api/payments/complete/route.ts")
const tips = read("app/api/social/tips/route.ts")
const checks = [
 ["creator reads server economy snapshot", creator.includes('/api/social/economy/status')],
 ["creator refreshes on curation", creator.includes('ghc:curation-updated')],
 ["creator refreshes on engagement", creator.includes('ghc:post-engagement')],
 ["creator refreshes on wallet", creator.includes('ghc:wallet-refresh')],
 ["creator has manual refresh", creator.includes('Refresh Creator Studio')],
 ["creator aggregates qualified views", creator.includes('totals.qualified')],
 ["creator exposes curation counts", creator.includes('totals.up') && creator.includes('totals.down')],
 ["creator opens canonical post insights", creator.includes('action: "insights"')],
 ["creator content carries community identity", store.includes('community_id,community_name') && creator.includes('p.community_name')],
 ["creator does not claim client-minted earnings", creator.includes('social actions do not mint GHC')],
 ["verified Pi tip settlement exists", complete.includes('gh_tip_settle_verified')],
 ["atomic GHC tip settlement exists", tips.includes('gh_tip_settle_ghc_atomic')],
 ["stale deferred settlement copy removed", !creator.includes('tips settlement deferred') && !creator.includes('no settlement yet')],
]
let pass = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (ok) pass++ }
console.log(`\nPhase 19 creator/profile convergence: ${pass}/${checks.length}`)
if (pass !== checks.length) process.exit(1)
