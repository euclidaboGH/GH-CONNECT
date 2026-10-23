import fs from "node:fs"
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const api = read("app/api/social/creator/route.ts")
const store = read("lib/server/creator/store.ts")
const panel = read("components/ghc/creator-studio-panel.tsx")
const tests = [
 ["creator API exposes server creator economy summary", api.includes("creatorEconomy: economy")],
 ["creator summary is server-side", api.includes("getCreatorEconomySummary(auth.userId, postIds)")],
 ["summary reads verified Pi tip settlements", store.includes("gh_tip_settlements")],
 ["summary reads atomic GHC tip settlements", store.includes("gh_tip_ghc_settlements")],
 ["summary reads content rewards", store.includes("gh_content_rewards")],
 ["summary reads authoritative ledger", store.includes("ghc_transactions")],
 ["summary distinguishes payable Pi tips", store.includes("status==='payable'")],
 ["summary distinguishes paid Pi tips", store.includes("status==='paid'")],
 ["summary counts tip records", store.includes("tipCount")],
 ["summary separates author and curation reward", store.includes("rewardAuthor") && store.includes("rewardCuration")],
 ["panel has performance windows", panel.includes("Performance window") && panel.includes("windowDays") && panel.includes("d === \"all\"")],
 ["panel shows author reward", panel.includes("Author reward recorded")],
 ["panel shows GHC tips", panel.includes("GHC tips settled")],
 ["panel shows verified Pi tips", panel.includes("Verified Pi tips")],
 ["panel avoids estimated earnings", panel.includes("not estimates")],
 ["creator endpoint no longer claims deferred settlement", !api.includes('settlement: "tips_deferred"')],
 ["legacy creator regression preserved", fs.existsSync(new URL("../scripts/test-phase19-creator-profile-convergence.mjs", import.meta.url))],
]
let pass=0
for (const [name, ok] of tests) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (ok) pass++ }
console.log(`\nPhase 27 creator economy V2: ${pass}/${tests.length}`)
if (pass !== tests.length) process.exit(1)
