/**
 * Step 5 — production verification pack (automated gates only).
 * Does NOT deploy, does NOT apply migrations, does NOT touch .env.
 *
 * Usage: node scripts/verify-production-release.mjs
 */
import { spawnSync } from "child_process"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const node = process.execPath

const SUITES = [
  ["scripts/scan-production-safety.mjs", "safety-scan"],
  ["scripts/test-authority-map-50.mjs", "authority-map"],
  ["scripts/test-community-authority-step1.mjs", "community-authority"],
  ["scripts/test-trust-authority-step2.mjs", "trust-authority"],
  ["scripts/test-governance-durability-step3.mjs", "governance-durability"],
  ["scripts/test-context-strangler-50-1.mjs", "context-strangler-50.1"],
  ["scripts/test-context-strangler-step4.mjs", "context-strangler-step4"],
  ["scripts/test-domain-contracts.mjs", "domain-contracts"],
  ["scripts/test-discovery-connections.mjs", "discovery-connections"],
  ["scripts/test-unified-connections.mjs", "unified-connections"],
  ["scripts/test-connection-inbox.mjs", "connection-inbox"],
  ["scripts/test-connection-ux.mjs", "connection-ux"],
  ["scripts/test-universal-search-intent.mjs", "universal-search"],
  ["scripts/test-communities.mjs", "communities"],
  ["scripts/test-community-belonging.mjs", "community-belonging"],
  ["scripts/test-community-hub.mjs", "community-hub"],
  ["scripts/test-community-governance.mjs", "community-governance"],
  ["scripts/test-community-health-safety.mjs", "community-health"],
  ["scripts/test-community-lifecycle-discovery.mjs", "community-lifecycle"],
  ["scripts/test-community-moderation-digest.mjs", "community-moderation"],
  ["scripts/test-community-onboarding.mjs", "community-onboarding"],
  ["scripts/test-community-participation-bridge.mjs", "community-participation-bridge"],
  ["scripts/test-community-participation-depth.mjs", "community-participation-depth"],
  ["scripts/test-community-participation.mjs", "community-participation"],
  ["scripts/test-community-feed-search.mjs", "community-feed-search"],
  ["scripts/test-home-os-audit.mjs", "home-os-audit"],
  ["scripts/test-social-experience-upgrade.mjs", "social-experience"],
  ["scripts/test-social-os-foundation.mjs", "social-os-foundation"],
  ["scripts/test-economy-v12.mjs", "economy-v12"],
  ["scripts/test-pi-payment-durable.mjs", "pi-payment-durable"],
]

function run(script) {
  const path = join(root, script)
  if (!existsSync(path)) {
    return { ok: false, code: 127, skipped: true, ms: 0 }
  }
  const t0 = Date.now()
  const res = spawnSync(node, [path], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 12 * 1024 * 1024,
  })
  return {
    ok: res.status === 0,
    code: res.status ?? 1,
    skipped: false,
    ms: Date.now() - t0,
    stderr: (res.stderr || "").slice(-400),
  }
}

console.log("\n╔══════════════════════════════════════════════════════════╗")
console.log("║  GH-CONNECT — STEP 5 PRODUCTION VERIFICATION PACK      ║")
console.log("╚══════════════════════════════════════════════════════════╝\n")

const results = []
let failCount = 0
let passCount = 0
let skipCount = 0

for (const [script, name] of SUITES) {
  process.stdout.write(`→ ${name} ... `)
  const r = run(script)
  if (r.skipped) {
    skipCount++
    console.log("SKIP (missing)")
    results.push({ name, status: "SKIP", ms: 0 })
    continue
  }
  if (r.ok) {
    passCount++
    console.log(`PASS (${r.ms}ms)`)
    results.push({ name, status: "PASS", ms: r.ms })
  } else {
    failCount++
    console.log(`FAIL (code ${r.code}, ${r.ms}ms)`)
    if (r.stderr) console.log(r.stderr)
    results.push({ name, status: "FAIL", ms: r.ms, code: r.code })
  }
}

// Operator gates — never claim executed here
const operatorGates = [
  { name: "npm install --legacy-peer-deps", status: "OPERATOR REQUIRED" },
  { name: "npm run typecheck", status: "OPERATOR REQUIRED" },
  { name: "npm run lint", status: "OPERATOR REQUIRED" },
  { name: "npm run build", status: "OPERATOR REQUIRED" },
  { name: "Supabase migration reconcile (prod)", status: "OPERATOR REQUIRED" },
  { name: "Live Test-Pi E2E in Pi Browser", status: "OPERATOR REQUIRED" },
  { name: "Multi-instance concurrency smoke", status: "OPERATOR REQUIRED" },
]

console.log("\n--- Automated suites ---")
console.log(`PASS: ${passCount}  FAIL: ${failCount}  SKIP: ${skipCount}`)

console.log("\n--- Operator gates (not executed in this environment) ---")
for (const g of operatorGates) {
  console.log(`  • ${g.name}: ${g.status}`)
}

const report = {
  generatedAt: new Date().toISOString(),
  step: "5",
  automated: results,
  passCount,
  failCount,
  skipCount,
  operatorGates,
  decision:
    failCount === 0
      ? "AUTOMATED_GATES_PASS — OPERATOR VERIFICATION STILL REQUIRED"
      : "AUTOMATED_GATES_FAIL",
}

const outPath = join(root, "docs/architecture/PRODUCTION_VERIFICATION_REPORT.json")
try {
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log("\nWrote", outPath)
} catch (e) {
  console.warn("Could not write report JSON:", e.message)
}

console.log("\n=== DECISION ===")
console.log(report.decision)
if (failCount) process.exit(1)
console.log("")
