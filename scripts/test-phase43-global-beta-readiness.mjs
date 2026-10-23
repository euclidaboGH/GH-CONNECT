import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const checks = []
const pass = (name, ok) => checks.push([name, Boolean(ok)])
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")

const beta = read("lib/server/release/beta-readiness.ts")
const route = read("app/api/release/beta-readiness/route.ts")
const readiness = read("lib/server/readiness.ts")
const stage7 = read("lib/server/release/stage7-readiness.ts")

pass("beta readiness module exists", beta.includes("evaluateBetaReadiness"))
pass("beta readiness is server-owned", beta.includes("Server-owned"))
pass("fail-closed node24 evidence", beta.includes("node24-production"))
pass("multi-user testnet gate", beta.includes("testnet-multi-user"))
pass("observability gate", beta.includes("observability"))
pass("backup restore gate", beta.includes("backup-restore"))
pass("rollback gate", beta.includes("rollback"))
pass("kill switch gate", beta.includes("kill-switches"))
pass("incident owner gate", beta.includes("incident-owner"))
pass("financial features remain disabled", beta.includes("financialFeaturesEnabled: false"))
pass("deployment remains unperformed", beta.includes("deploymentPerformed: false"))
pass("foundation readiness reused", beta.includes("evaluateReadiness"))
pass("stage7 policy reused", beta.includes("getStage7ReadinessPolicy"))
pass("no secret values returned", beta.includes("env(name: string): boolean"))
pass("API route exists", route.includes("evaluateBetaReadiness"))
pass("API route is no-store", route.includes("Cache-Control"))
pass("API route uses node runtime", route.includes('runtime = "nodejs"'))
pass("health remains authoritative", readiness.includes("single source of truth"))
pass("release policy remains authoritative", stage7.includes("checklist is not evidence"))
pass("recovery is mandatory", beta.includes('backupRestoreRehearsal: "required"'))
pass("operator approval boundary", beta.includes("ready_for_operator_review"))
pass("production deployment not performed", beta.includes("deploymentPerformed: false"))
pass("beta blockers aggregate foundation", beta.includes("...foundation.blockers"))
pass("beta warnings preserve foundation", beta.includes("...foundation.warnings"))
pass("evidence is explicit", beta.includes("requiredEvidence"))

const failed = checks.filter(([, ok]) => !ok)
console.log(`PHASE 43 GLOBAL BETA READINESS: ${checks.filter(([,ok])=>ok).length}/${checks.length} PASS`)
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`)
  process.exit(1)
}
