#!/usr/bin/env node
/** Recovery-track Phase 4 gate: source contracts pass first; operational evidence is mandatory for release. */
import { lstatSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = process.cwd()
const checks = [
  ['Phase 3 recovery source contract', ['scripts/check-phase3-database-recovery.mjs']],
  ['read-only restored catalog gate contract', ['scripts/check-phase3-restore-catalog-gate.mjs']],
  ['restore evidence validator behavior', ['scripts/test-database-restore-evidence-validator.mjs']],
]
let failed = 0
for (const [label, args] of checks) {
  console.log(`\n=== ${label} ===`)
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', timeout: 60_000, killSignal: 'SIGTERM' })
  if (result.error || result.status !== 0) {
    failed++
    const detail = result.error?.message ?? (result.signal ? `terminated by ${result.signal} (possible timeout)` : `exit status ${result.status}`)
    console.error(`FAIL ${label}: ${detail}`)
  } else console.log(`PASS ${label}`)
}
if (failed) {
  console.error(`\nBLOCKED: ${failed} source contract suite(s) failed.`)
  process.exit(1)
}
console.log('\nPASS all offline recovery source contracts')
const evidencePath = process.env.GH_RESTORE_EVIDENCE_PATH
if (!evidencePath) {
  console.error('BLOCKED: set GH_RESTORE_EVIDENCE_PATH to the redacted evidence file from a real disposable PostgreSQL restore drill.')
  console.error('Source checks do not prove a restore. No database was contacted by this gate.')
  if (process.argv.includes('--require-operational-evidence')) process.exit(2)
  console.log('Source-only invocation is green; operational release remains blocked until evidence is supplied.')
  process.exit(0)
}
const resolvedEvidence = resolve(evidencePath)
try {
  const info = lstatSync(resolvedEvidence)
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('path is not a regular, non-symlink file')
} catch (error) {
  console.error(`BLOCKED: evidence file is unavailable: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exit(2)
}
console.log(`\n=== validating operator evidence: ${resolvedEvidence} ===`)
const result = spawnSync(process.execPath, ['scripts/validate-database-restore-evidence.mjs', resolvedEvidence], { cwd: root, stdio: 'inherit', timeout: 30_000, killSignal: 'SIGTERM' })
if (result.error || result.status !== 0) {
  const detail = result.error?.message ?? (result.signal ? `validator terminated by ${result.signal} (possible timeout)` : `validator exit status ${result.status}`)
  console.error(`BLOCKED: restore evidence is incomplete or the drill did not pass (${detail}).`)
  process.exit(result.status === null ? 1 : result.status || 1)
}
console.log('\nPASS evidence completeness gate. Independent verification of source logs, migration history, RPO/RTO, and smoke tests remains a human operational approval.')
