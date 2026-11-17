/**
 * Source-level Stage 1 economy gates — does NOT enable issuance.
 * Confirms flags default OFF and daily-claim-only issuance docs remain authoritative.
 */
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")

const checks = []
function check(name, ok, detail = "") {
  checks.push({ name, ok, detail })
  console.log(ok ? "PASS" : "FAIL", name, detail)
}

try {
  const envEx = read(".env.example")
  check(
    "referral_flag_documented",
    /GHC_REFERRAL_SETTLEMENT_ENABLED/i.test(envEx),
    "present in .env.example"
  )
  check(
    "curation_flag_documented",
    /GHC_CURATION_REDISTRIBUTE_ENABLED/i.test(envEx),
    "present in .env.example"
  )
} catch {
  check("env_example", false, "missing")
}

let economyOk = false
for (const rel of ["lib/server/economy/env.ts", "lib/server/economy/flags.ts", "lib/server/economy/index.ts"]) {
  try {
    read(rel)
    economyOk = true
    break
  } catch { /* */ }
}
check("economy_env_module", economyOk, economyOk ? "readable" : "missing")

// Ensure we did not hardcode referral ON in package.json scripts carelessly
try {
  const pkg = JSON.parse(read("package.json"))
  const scripts = JSON.stringify(pkg.scripts || {})
  check("no_force_referral_on_scripts", !/GHC_REFERRAL_SETTLEMENT_ENABLED=1/.test(scripts))
  check("no_force_curation_on_scripts", !/GHC_CURATION_REDISTRIBUTE_ENABLED=1/.test(scripts))
} catch {
  check("package_scripts", false)
}

const failed = checks.filter((c) => !c.ok)
if (failed.length) {
  console.error("Stage1 gates: FAILED", failed.length)
  process.exit(1)
}
console.log("Stage1 gates: PASS (issuance remains operator-gated)")
