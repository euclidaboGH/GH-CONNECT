import fs from "node:fs"
const read = (p) => fs.readFileSync(p, "utf8")
const center = read("components/ghc/unified-activity-center.tsx")
const profile = read("components/ghc/profile-screen.tsx")
const resolver = read("lib/domains/ghc-activity-attribution.ts")
const rewards = read("components/ghc/rewards-centre-screen.tsx")
const creator = read("components/ghc/creator-studio-panel.tsx")
const checks = [
 ["activity center exists", center.includes("export function UnifiedActivityCenter")],
 ["uses canonical ledger", center.includes("getTransactions?.(limit)")],
 ["uses canonical rewards", center.includes("getRewards?.(limit)")],
 ["deduplicates reward ledger correlation", center.includes("txRewardIds")],
 ["uses shared attribution resolver", center.includes("resolveGhcActivityAttribution")],
 ["uses shared target navigation", center.includes("navigateGhcActivityTarget")],
 ["filters social/community/marketplace/reward/transfer", ["social","community","marketplace","reward","transfer"].every(x => center.includes(`\"${x}\"`))],
 ["syncs wallet changes", center.includes('ghc:wallet-refresh')],
 ["syncs curation changes", center.includes('ghc:curation-updated')],
 ["syncs post engagement", center.includes('ghc:post-engagement')],
 ["reward rows open canonical rewards history", center.includes('ghc:open-rewards-tab') && center.includes('detail: "history"')],
 ["profile dashboard embeds unified activity", profile.includes("<UnifiedActivityCenter limit={40} />")],
 ["attribution remains read only", resolver.includes("deliberately read-only") && resolver.includes("never creates rewards")],
 ["market order fallback attribution", resolver.includes("/^market_order_/i")],
 ["reward source resolver", resolver.includes("resolveRewardActivityTarget")],
 ["reward history deep-links to source", rewards.includes("Open source activity") && rewards.includes("resolveRewardActivityTarget")],
 ["creator studio embeds shared activity", creator.includes("<UnifiedActivityCenter limit={12} />")],
]
let pass=0
for (const [name, ok] of checks) { console.log(`${ok?"PASS":"FAIL"} ${name}`); if(ok) pass++ }
console.log(`\n${pass}/${checks.length} checks passed`)
if(pass!==checks.length) process.exit(1)
