import { readFileSync, existsSync } from "fs"
import { join } from "path"
const root = process.cwd()
const fails = []
const read = (r) => {
  const p = join(root, r)
  if (!existsSync(p)) { fails.push("missing "+r); return "" }
  return readFileSync(p, "utf8")
}
const data = read("lib/ghc-data.ts")
if (!data.includes("Mentorship") || !data.includes("Agriculture")) fails.push("expanded INTERESTS expected")
const ob = read("components/ghc/onboarding.tsx")
if (!ob.includes("customInterest")) fails.push("onboarding custom interest required")
if (!ob.includes("Add your own")) fails.push("onboarding custom UI required")
const pc = read("components/ghc/profile-components.tsx")
if (!pc.includes("togglePresetInterest")) fails.push("edit profile presets required")
if (!pc.includes("cleanInterests")) fails.push("edit save must clean interests")
if (fails.length) { console.error(fails); process.exit(1) }
console.log("test-profile-interests-static: PASS")
