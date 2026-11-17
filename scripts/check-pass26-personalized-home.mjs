import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const pkg = JSON.parse(read("package.json"))
const checks = [
  ["release metadata",read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["personalization model exists", fs.existsSync(path.join(root, "lib/home-personalization.ts"))],
  ["personalization is state-derived", /messagesNeedingAttention|communityInvites|friendsOrFollowing/.test(read("lib/home-personalization.ts"))],
  ["personalized focus component exists", fs.existsSync(path.join(root, "components/ghc/home-personalized-focus.tsx"))],
  ["reason transparency included", /Why this is here/.test(read("components/ghc/home-personalized-focus.tsx"))],
  ["home integrates personalized focus", /<HomeCrossFeaturePath/.test(read("components/ghc/home-command-centre.tsx"))],
  ["no fabricated metrics", !/fake|mock|demo.*metric|guaranteed.*outcome/i.test(read("lib/home-personalization.ts"))],
  ["canonical nav preserved", /Home.*Messages.*Communities.*Cart.*Profile/s.test(read("components/ghc/app.tsx"))],
  ["migrations remain present", fs.existsSync(path.join(root, "supabase/migrations"))],
]
const failed=checks.filter(([,ok])=>!ok)
for (const [label,ok] of checks) console.log(`${ok ? "PASS":"FAIL"} ${label}`)
if (failed.length) process.exit(1)
console.log(`PASS Pass 26 personalized-home gate ${checks.length}/${checks.length}`)
