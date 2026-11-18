import fs from "node:fs"
const required = [
  "lib/home-journey.ts",
  "components/ghc/home-journey-card.tsx",
  "components/ghc/home-command-centre.tsx",
  "lib/app-release.ts",
]
for (const file of required) if (!fs.existsSync(file)) throw new Error(`Missing ${file}`)
const journey = fs.readFileSync("lib/home-journey.ts", "utf8")
const card = fs.readFileSync("components/ghc/home-journey-card.tsx", "utf8")
const home = fs.readFileSync("components/ghc/home-command-centre.tsx", "utf8")
const release = fs.readFileSync("lib/app-release.ts", "utf8")
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
const checks = [
  ["journey model", journey.includes("buildHomeJourney") && journey.includes("profile") && journey.includes("participate")],
  ["next-step targeting", journey.includes("next: steps.find") && card.includes("open(journey.next!.target)")],
  ["home integration", home.includes("<HomeJourneyCard journey={journey} />") || home.includes("<HomeOutcomePanel")],
  ["accessible action", card.includes("min-h-14") && card.includes("focus-visible:ring-2")],
  ["release metadata", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
]
let pass = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} — ${name}`); if (ok) pass++ }
console.log(`PASS ${pass}/${checks.length}`)
if (pass !== checks.length) process.exit(1)
