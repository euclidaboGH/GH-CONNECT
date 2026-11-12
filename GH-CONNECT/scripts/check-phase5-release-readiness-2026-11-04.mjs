#!/usr/bin/env node
/**
 * Phase 5 — Release readiness meta-gate (source).
 * Runs Phase 2–4 contracts as child checks and validates ops docs + fail-closed env notes.
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
let pass = 0
let fail = 0
function ok(name, cond, detail = "") {
  if (cond) {
    pass++
    console.log(`PASS ${name}`)
  } else {
    fail++
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

function runChild(rel) {
  const script = join(root, rel)
  if (!existsSync(script)) {
    ok(`child ${rel}`, false, "missing")
    return
  }
  const r = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" })
  const out = `${r.stdout || ""}${r.stderr || ""}`
  if (r.status === 0) {
    ok(`child ${rel}`, true)
  } else {
    ok(`child ${rel}`, false, (out.split("\n").filter((l) => l.startsWith("FAIL")).slice(0, 3).join(" | ") || `exit ${r.status}`))
  }
}

runChild("scripts/check-phase2-architecture-identity-2026-11-04.mjs")
runChild("scripts/check-phase3-finance-commerce-2026-11-04.mjs")
runChild("scripts/check-phase4-product-experience-2026-11-04.mjs")

const envEx = join(root, ".env.example")
const env = existsSync(envEx) ? readFileSync(envEx, "utf8") : ""
ok("A2U fail-closed in env example", /PI_A2U_ENABLED=0/.test(env))
ok("payout requests fail-closed", /PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=0/.test(env))
ok("payout execution fail-closed", /PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=0/.test(env))
ok("withdrawals health route exists", existsSync(join(root, "app/api/health/withdrawals/route.ts")))
ok("phase 5 readiness doc", existsSync(join(root, "docs/PHASE-5-RELEASE-READINESS-2026-11-04.md")))
ok("legacy operator Testnet checklist retained", existsSync(join(root, "docs/OPERATOR_TESTNET_RELEASE_CHECKLIST_0.312.md")))

const mkt = existsSync(join(root, "components/ghc/marketplace-screen.tsx"))
  ? readFileSync(join(root, "components/ghc/marketplace-screen.tsx"), "utf8")
  : ""
ok("cart checkout aria-busy", mkt.includes("aria-busy={busy"))

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
ok("package version is valid semantic version", /^\d+\.\d+\.\d+$/.test(pkg.version))
const man = existsSync(join(root, "VERIFIED_MANIFEST.txt"))
  ? readFileSync(join(root, "VERIFIED_MANIFEST.txt"), "utf8")
  : ""
ok("manifest project_version matches package", man.includes(`project_version=${pkg.version}`))

console.log(`\nPhase 5 release readiness: ${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
