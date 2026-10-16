#!/usr/bin/env node
/**
 * Phase 14 static verification runner (no network, no DB).
 * Runs the critical in-repo suites in sequence. Exits non-zero on first failure.
 */
import { spawnSync } from "child_process"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const steps = [
  ["test-social-authz.mjs", "Social authz"],
  ["test-idor-static.mjs", "IDOR static"],
  ["test-messaging-authz.mjs", "Messaging authz"],
  ["scan-production-safety.mjs", "Production safety"],
  ["test-ghpv-economic-safety.mjs", "GHPV economic safety"],
  ["test-content-reward-boundaries.mjs", "Content reward boundaries"],
  ["test-pi-payment-durable.mjs", "Pi payment durable"],
  ["test-economy-v12.mjs", "Economy v12"],
  ["test-daily-claim-wallet-pipeline.mjs", "Daily claim → wallet"],
  ["check-jsx-safety.mjs", "JSX safety"],
  ["print-migration-checklist.mjs", "Migration inventory"],
]

console.log("\n=== GH-CONNECT verify:static (Phase 14) ===\n")
let failed = 0
for (const [file, label] of steps) {
  process.stdout.write(`→ ${label} ... `)
  const r = spawnSync(process.execPath, [join(root, "scripts", file)], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  })
  if (r.status === 0) {
    console.log("PASS")
  } else {
    console.log("FAIL")
    failed++
    if (r.stdout) process.stdout.write(r.stdout.split("\n").slice(-15).join("\n") + "\n")
    if (r.stderr) process.stderr.write(r.stderr.split("\n").slice(-15).join("\n") + "\n")
  }
}
console.log(`\n=== verify:static ${failed ? "FAILED" : "PASSED"} (${steps.length - failed}/${steps.length}) ===\n`)
process.exit(failed ? 1 : 0)
