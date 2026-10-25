#!/usr/bin/env node
/** Local, network-free release checks for suites that actually exist in this source tree. */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const steps = [
  ["check-dependency-lock-integrity.mjs", "Dependency lock integrity"],
  ["verify-pi-backend-lock.mjs", "Pi backend lock"],
  ["check-jsx-safety.mjs", "JSX safety"],
  ["scan-production-safety.mjs", "Production safety"],
  ["check-database-contract-source.mjs", "Database contract source"],
  ["check-migration-release-readiness.mjs", "Migration release readiness"],
  ["test-fee-referral-contract.mjs", "Fee and referral contract"],
  ["check-phase2-reward-contract.mjs", "Phase 2 reward/payment contract"],
  ["check-phase25-premium-ui.mjs", "Phase 25 premium UI contract"],
]

console.log("\n=== GreenHaven static verification (network/DB independent) ===\n")
let failed = 0
for (const [file, label] of steps) {
  const path = join(root, "scripts", file)
  process.stdout.write(`→ ${label} ... `)
  if (!existsSync(path)) {
    console.log("FAIL (required check missing)")
    failed++
    continue
  }
  const r = spawnSync(process.execPath, [path], { cwd: root, encoding: "utf8", env: process.env, maxBuffer: 8 * 1024 * 1024 })
  if (r.status === 0) console.log("PASS")
  else {
    console.log("FAIL")
    if (r.stdout) process.stdout.write(r.stdout.slice(-5000) + "\n")
    if (r.stderr) process.stderr.write(r.stderr.slice(-5000) + "\n")
    failed++
  }
}
console.log(`\n=== Static verification ${failed ? "FAILED" : "PASSED"} (${steps.length - failed}/${steps.length}) ===\n`)
process.exit(failed ? 1 : 0)
