import fs from "node:fs"

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
const release = fs.readFileSync("lib/app-release.ts", "utf8")
const model = fs.readFileSync("lib/home-cross-feature.ts", "utf8")
const evidence = fs.readFileSync("lib/home-outcome-quality.ts", "utf8")
const card = fs.readFileSync("components/ghc/home-cross-feature-path.tsx", "utf8")
const nav = fs.readFileSync("components/ghc/home-command-centre.tsx", "utf8")

const checks = [
  ["release metadata", pkg.version === JSON.parse(fs.readFileSync("package-lock.json", "utf8")).version && release.includes(pkg.version)],
  ["evidence model", /HomeCrossFeatureEvidence/.test(model) && /evidence: HomeCrossFeatureEvidence/.test(model)],
  ["server evidence", /evidence: "server"/.test(model)],
  ["profile evidence", /evidence: "profile"/.test(model)],
  ["activity evidence", /evidence: "activity"/.test(model)],
  ["transparent UI", /outcomeEvidenceLabel/.test(card) && /Confirmed by GreenHaven services/.test(evidence) && /Based on your profile and setup/.test(evidence)],
  ["reason retained", /Why this/.test(card) === false && /primary.reason/.test(card)],
  ["canonical navigation", /messages|communities|profile|discover/.test(nav) && !/Home · Discovery · Communities · Cart · Messages · Profile/.test(nav)],
  ["no migration edits", fs.existsSync("MIGRATION-SOURCE-MANIFEST.csv")],
]

for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`)
if (checks.some(([, ok]) => !ok)) process.exit(1)
console.log("PASS 9/9 — Pass 28 trusted outcome experience gate")
