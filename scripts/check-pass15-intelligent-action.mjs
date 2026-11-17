import fs from "node:fs"
const read = p => fs.readFileSync(p, "utf8")
const pkg = JSON.parse(read("package.json"))
const release = read("lib/app-release.ts")
const home = read("components/ghc/home-command-centre.tsx")
const action = read("components/ghc/home-action-centre.tsx")
const outcome = read("components/ghc/home-outcome-panel.tsx")
const resolver = read("lib/domains/adapters/home-next-action.ts")
const checks = [
  ["release 0.237.0", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["single outcome surface", (home.includes("HomeActionCentre") && action.includes("What matters now")) || (home.includes("HomeOutcomePanel") && outcome.includes("Your next outcome"))],
  ["state-derived action", home.includes("resolveHomeNextAction") && ((action.includes("HomeNextAction")) || outcome.includes("HomeNextAction"))],
  ["clear primary CTA", (action.includes("action.cta") || outcome.includes("action.cta")) && (action.includes("onAction") || outcome.includes("onAction"))],
  ["attention hierarchy", (action.includes('action.urgency === "high"') && action.includes("CircleAlert")) || outcome.includes("CircleAlert")],
  ["low-noise success state", (action.includes('action.urgency !== "low"') && action.includes("CheckCircle2")) || outcome.includes("CheckCircle2")],
  ["canonical destinations", resolver.includes('"profile" | "messages" | "communities" | "discover" | "home"')],
  ["wallet remains overlay only", !outcome.includes('goTab("wallet")') && home.includes('navigateTo("wallet")')],
  ["no fake outcome data", !action.includes("Math.random") && !action.includes("demo")],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} — ${name}`); if (!ok) failed++ }
console.log(`\nPass 15 intelligent-action gate: ${checks.length-failed}/${checks.length}`)
if (failed) process.exit(1)
