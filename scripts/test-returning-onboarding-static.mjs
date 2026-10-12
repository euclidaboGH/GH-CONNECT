import { readFileSync, existsSync } from "fs"
import { join } from "path"
const root = process.cwd()
const fails = []
const read = (r) => {
  const p = join(root, r)
  if (!existsSync(p)) { fails.push("missing "+r); return "" }
  return readFileSync(p, "utf8")
}
const local = read("lib/onboarding-local.ts")
if (!local.includes("ghc.profile")) fails.push("stamp should consult ghc.profile")
if (!local.includes("Local device proof beats")) fails.push("UI gate local-win missing")

const ctx = read("contexts/ghc-context.tsx")
if (!ctx.includes("hasLocalOnboardingStampForUser")) fails.push("context must use stamp")
if (!ctx.includes("BOOT_PROFILE_HYDRATE")) fails.push("boot hydrate required")
if (!ctx.includes("Returning-user guard")) fails.push("hydrate guard required")

if (fails.length) {
  console.error(fails)
  process.exit(1)
}
console.log("test-returning-onboarding-static: PASS")
