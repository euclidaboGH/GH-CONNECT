/**
 * GreenHaven production verification pack.
 *
 * Discovers the source-contract checks actually present in scripts/ so this
 * gate cannot silently pass because a stale hard-coded test list is missing.
 * This is source-only verification: it never deploys, applies migrations,
 * mutates .env files, or claims live provider/database verification.
 *
 * Usage: node scripts/verify-production-release.mjs
 */
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const scriptsDir = join(root, "scripts")
const node = process.execPath
const excluded = new Set([
  "verify-production-release.mjs", // this orchestrator
  "check-node-runtime.mjs", // run separately under the required Node 24 runtime
  "verify-database-backup-artifact.mjs", // operator utility; requires an explicit dump artifact argument
])
const discovered = readdirSync(scriptsDir)
  .filter((name) => /^(check|verify)-.*\.mjs$/.test(name) && !excluded.has(name) && existsSync(join(scriptsDir, name)))
  .sort()

if (discovered.length === 0) {
  console.error("FAIL: no source verification scripts were discovered.")
  process.exit(1)
}

function run(script) {
  const started = Date.now()
  const result = spawnSync(node, [join(scriptsDir, script)], {
    cwd: root, encoding: "utf8", env: process.env,
    maxBuffer: 12 * 1024 * 1024, timeout: 120_000,
  })
  return {
    ok: result.status === 0,
    code: result.status ?? 1,
    ms: Date.now() - started,
    stdout: (result.stdout || "").slice(-1200),
    stderr: (result.stderr || "").slice(-1200),
    timedOut: result.error?.code === "ETIMEDOUT",
  }
}

console.log("\n╔══════════════════════════════════════════════════════════╗")
console.log("║  GREENHAVEN — SOURCE VERIFICATION PACK                 ║")
console.log("╚══════════════════════════════════════════════════════════╝")
console.log(`Discovered ${discovered.length} check scripts; missing scripts cannot be silently skipped.\n`)

const results = []
for (const script of discovered) {
  process.stdout.write(`→ ${script} ... `)
  const result = run(script)
  const status = result.ok ? "PASS" : "FAIL"
  console.log(`${status} (${result.ms}ms)`)
  if (!result.ok) {
    if (result.stdout) console.log(result.stdout)
    if (result.stderr) console.log(result.stderr)
  }
  results.push({ name: script, status, code: result.code, ms: result.ms, timedOut: result.timedOut,
    ...(result.ok ? {} : { stdout: result.stdout, stderr: result.stderr }) })
}

const passCount = results.filter((r) => r.status === "PASS").length
const failCount = results.length - passCount
const runtime = {
  version: process.version,
  supported: /^v24\.(1[5-9]|[2-9]\d|[1-9]\d{2,})\./.test(process.version),
}
const operatorGates = [
  { name: "Locked dependency install on supported Node.js 24", status: "REQUIRED" },
  { name: "TypeScript typecheck", status: "REQUIRED" },
  { name: "ESLint", status: "REQUIRED" },
  { name: "Next.js production build", status: "REQUIRED" },
  { name: "Browser E2E and responsive visual review", status: "REQUIRED" },
  { name: "Supabase migration reconciliation and restore rehearsal", status: "REQUIRED" },
  { name: "Live Testnet/provider and multi-instance concurrency tests", status: "REQUIRED" },
  { name: "Security review of live authorization, RLS, storage and secrets", status: "REQUIRED" },
]
const report = {
  generatedAt: new Date().toISOString(),
  scope: "source-only verification; not production approval",
  runtime, discoveredCount: discovered.length, passCount, failCount, results, operatorGates,
  decision: failCount === 0 ? "SOURCE_CHECKS_PASS — BUILD_AND_OPERATOR_VERIFICATION_STILL_REQUIRED" : "SOURCE_CHECKS_FAIL",
}
const outPath = join(root, "docs/architecture/PRODUCTION_VERIFICATION_REPORT.json")
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n")
console.log(`\nPASS: ${passCount}  FAIL: ${failCount}`)
console.log(`Runtime: ${runtime.version} (${runtime.supported ? "supported" : "unsupported; use Node.js ^24.15.0 for build checks"})`)
console.log(`Wrote ${outPath}`)
console.log(`Decision: ${report.decision}`)
if (failCount) process.exit(1)
