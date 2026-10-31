#!/usr/bin/env node
/**
 * Phase 5 operator gate — runs static checks available without cookies,
 * then points to live two-account probes.
 *
 * Usage:
 *   node scripts/operator-phase5-gate.mjs
 *   GHC_E2E_BASE_URL=... GHC_E2E_COOKIE_A=... GHC_E2E_COOKIE_B=... node scripts/operator-phase5-gate.mjs --live
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const live = process.argv.includes("--live")

function run(label, cmd, args) {
  console.log(`\n=== ${label} ===`)
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env: process.env })
  if (r.status !== 0) {
    console.error(`\nGATE FAIL: ${label} exit=${r.status}`)
    process.exit(r.status || 1)
  }
}

console.log("GH-CONNECT Phase 5 operator gate")
console.log(`root=${root}`)

// Static / source gates
if (existsSync(path.join(root, "scripts/check-jsx-safety.mjs"))) {
  run("jsx-safety", "node", ["scripts/check-jsx-safety.mjs"])
}
if (existsSync(path.join(root, "scripts/operator-multiuser-migrations.mjs"))) {
  run("multiuser-migrations-inventory", "node", ["scripts/operator-multiuser-migrations.mjs"])
}
if (existsSync(path.join(root, "scripts/operator-verify-migration-defs.mjs"))) {
  run("verify-migration-defs", "node", ["scripts/operator-verify-migration-defs.mjs"])
}

if (live) {
  if (!process.env.GHC_E2E_BASE_URL || !process.env.GHC_E2E_COOKIE_A || !process.env.GHC_E2E_COOKIE_B) {
    console.error("\n--live requires GHC_E2E_BASE_URL, GHC_E2E_COOKIE_A, GHC_E2E_COOKIE_B")
    process.exit(2)
  }
  run("live-e2e-social", "node", ["scripts/operator-live-e2e-social.mjs"])
  if (existsSync(path.join(root, "scripts/operator-live-e2e-media-dm.mjs"))) {
    run("live-e2e-media-dm", "node", ["scripts/operator-live-e2e-media-dm.mjs"])
  }
} else {
  console.log("\n(static only) Re-run with --live and session cookies for two-account proof.")
}

console.log("\nRESULT: Phase 5 static gate PASS")
console.log("See docs/PHASE_5_OPERATOR_EVIDENCE.md for the full evidence checklist.")
process.exit(0)
