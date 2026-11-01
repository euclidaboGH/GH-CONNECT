import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const read = (f) => fs.readFileSync(path.join(root, f), "utf8")
const home = read("components/ghc/home-command-centre.tsx")
const model = read("lib/home-cross-feature.ts")
const card = read("components/ghc/home-cross-feature-path.tsx")
const pkg = read("package.json")
const checks = [
  ["release metadata", read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${JSON.parse(read("package.json")).version}"`)],
  ["package version synchronized", JSON.parse(read("package.json")).version === JSON.parse(read("package-lock.json")).version],
  ["cross-feature model exists", fs.existsSync(path.join(root, "lib/home-cross-feature.ts"))],
  ["authoritative wallet state is used", /walletReady|pendingGhc|lockedGhc/.test(model)],
  ["authoritative daily claim state is used", /dailyClaimable|claimable/.test(model) && /useDailyClaimStatus/.test(home)],
  ["cross-feature UI exists", fs.existsSync(path.join(root, "components/ghc/home-cross-feature-path.tsx"))],
  ["home integrates cross-feature path", /<HomeCrossFeaturePath/.test(home)],
  ["no fabricated outcomes", !/fake|mock|demo.*metric|guaranteed.*outcome/i.test(model + card)],
  ["canonical nav preserved", /Home.*Messages.*Communities.*Cart.*Profile/s.test(read("components/ghc/app.tsx"))],
  ["migrations untouched", fs.existsSync(path.join(root, "supabase/migrations"))],
]
const failed = checks.filter(([, ok]) => !ok)
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
if (failed.length) process.exit(1)
console.log(`PASS Pass 27 cross-feature experience gate ${checks.length}/${checks.length}`)
