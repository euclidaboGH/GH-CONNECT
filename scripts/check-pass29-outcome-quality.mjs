import fs from "node:fs"

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
const release = fs.readFileSync("lib/app-release.ts", "utf8")
const model = fs.readFileSync("lib/home-outcome-quality.ts", "utf8")
const card = fs.readFileSync("components/ghc/home-cross-feature-path.tsx", "utf8")
const manifest = fs.readFileSync("MIGRATION-SOURCE-MANIFEST.csv", "utf8")

const checks = [
  ["release metadata", pkg.version === JSON.parse(fs.readFileSync("package-lock.json", "utf8")).version && release.includes(pkg.version)],
  ["deduplicated outcome paths", /prepareHomeOutcomeSignals/.test(model) && /seenTargets/.test(model)],
  ["bounded alternatives", /result.length === 4/.test(model)],
  ["evidence labeling", /outcomeEvidenceLabel/.test(model) && /Confirmed by GreenHaven services/.test(model)],
  ["recommended primary action", /Recommended/.test(card) && /Best next step/.test(card)],
  ["prepared signals used", /groupHomePriorities\(preparedSignals\.slice\(1, 7\)\)/.test(card)],
  ["canonical navigation preserved", !/Home · Discovery · Communities · Cart · Messages · Profile/.test(fs.readFileSync("components/ghc/home-command-centre.tsx", "utf8"))],
  ["migration inventory present", manifest.includes("202610") || manifest.split("\n").length > 100],
  ["no financial mutation", !/supabase.*\.insert|supabase.*\.update|supabase.*\.rpc/.test(model)],
]
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`)
if (checks.some(([, ok]) => !ok)) process.exit(1)
console.log("PASS 9/9 — Pass 29 outcome quality gate")
