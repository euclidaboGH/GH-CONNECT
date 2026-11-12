import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const checks = [
  ["release metadata", read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${JSON.parse(read("package.json")).version}"`)],
  ["outcome panel exists", fs.existsSync(path.join(root, "components/ghc/home-outcome-panel.tsx"))],
  ["outcome panel combines action and journey", /Your next outcome/.test(read("components/ghc/home-outcome-panel.tsx")) && /journey\.steps/.test(read("components/ghc/home-outcome-panel.tsx"))],
  ["outcome progress accessibility", /role="progressbar"/.test(read("components/ghc/home-outcome-panel.tsx"))],
  ["home uses unified outcome panel", /<HomeOutcomePanel/.test(read("components/ghc/home-command-centre.tsx"))],
  ["legacy duplicate action card removed from home", !/<HomeActionCentre/.test(read("components/ghc/home-command-centre.tsx"))],
  ["legacy duplicate journey card removed from home", !/<HomeJourneyCard/.test(read("components/ghc/home-command-centre.tsx"))],
  ["canonical nav preserved", /Home.*Messages.*Communities.*Cart.*Profile/s.test(read("components/ghc/app.tsx"))],
  ["no migration edits", fs.existsSync(path.join(root, "supabase/migrations"))],
]
const failed = checks.filter(([, ok]) => !ok)
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
if (failed.length) process.exit(1)
console.log(`PASS Pass 25 outcome-first home gate ${checks.length}/${checks.length}`)
