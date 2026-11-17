#!/usr/bin/env node
/** Regression tests for fail-closed behavior of the Phase 4 operational recovery gate. */
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const gate = resolve('scripts/check-phase4-recovery-release-gate.mjs')
const cleanEnv = { ...process.env }
delete cleanEnv.GH_RESTORE_EVIDENCE_PATH

const strict = spawnSync(process.execPath, [gate, '--require-operational-evidence'], {
  cwd: process.cwd(), env: cleanEnv, encoding: 'utf8', timeout: 30_000,
})
assert.equal(strict.error, undefined, `strict gate failed to start: ${strict.error?.message ?? ''}`)
assert.equal(strict.status, 2, `strict gate must block without evidence; got ${strict.status}\n${strict.stdout}\n${strict.stderr}`)
assert.match(`${strict.stdout}\n${strict.stderr}`, /GH_RESTORE_EVIDENCE_PATH/)
console.log('PASS strict release mode blocks when operational evidence is absent')

const sourceOnly = spawnSync(process.execPath, [gate], {
  cwd: process.cwd(), env: cleanEnv, encoding: 'utf8', timeout: 30_000,
})
assert.equal(sourceOnly.error, undefined, `source-only gate failed to start: ${sourceOnly.error?.message ?? ''}`)
assert.equal(sourceOnly.status, 0, `source-only mode should run offline contracts without claiming operational completion; got ${sourceOnly.status}\n${sourceOnly.stdout}\n${sourceOnly.stderr}`)
assert.match(`${sourceOnly.stdout}\n${sourceOnly.stderr}`, /operational release remains blocked/i)
console.log('PASS source-only mode clearly preserves the operational release block')

const missingEvidence = spawnSync(process.execPath, [gate, '--require-operational-evidence'], {
  cwd: process.cwd(), env: { ...cleanEnv, GH_RESTORE_EVIDENCE_PATH: '/definitely/missing/greenhaven-restore-evidence.json' },
  encoding: 'utf8', timeout: 30_000,
})
assert.equal(missingEvidence.error, undefined, `missing-evidence gate failed to start: ${missingEvidence.error?.message ?? ''}`)
assert.equal(missingEvidence.status, 2, `strict gate must block for a missing evidence file; got ${missingEvidence.status}\n${missingEvidence.stdout}\n${missingEvidence.stderr}`)
assert.match(`${missingEvidence.stdout}\n${missingEvidence.stderr}`, /evidence file is unavailable/i)
console.log('PASS strict release mode blocks when evidence path does not resolve to a file')

const tempDir = mkdtempSync(join(tmpdir(), 'gh-phase4-gate-'))
try {
  const malformedEvidencePath = join(tempDir, 'malformed-evidence.json')
  writeFileSync(malformedEvidencePath, '[]')
  const malformedEvidence = spawnSync(process.execPath, [gate, '--require-operational-evidence'], {
    cwd: process.cwd(), env: { ...cleanEnv, GH_RESTORE_EVIDENCE_PATH: malformedEvidencePath },
    encoding: 'utf8', timeout: 30_000,
  })
  assert.equal(malformedEvidence.error, undefined, `malformed-evidence gate failed to start: ${malformedEvidence.error?.message ?? ''}`)
  assert.notEqual(malformedEvidence.status, 0, `strict gate must reject malformed evidence; got ${malformedEvidence.status}\n${malformedEvidence.stdout}\n${malformedEvidence.stderr}`)
  assert.match(`${malformedEvidence.stdout}\n${malformedEvidence.stderr}`, /top-level JSON value must be an object/i)
  console.log('PASS strict release mode blocks malformed evidence JSON')

  const symlinkTargetPath = join(tempDir, 'symlink-target.json')
  const symlinkEvidencePath = join(tempDir, 'evidence-link.json')
  writeFileSync(symlinkTargetPath, '[]')
  symlinkSync(symlinkTargetPath, symlinkEvidencePath)
  const symlinkEvidence = spawnSync(process.execPath, [gate, '--require-operational-evidence'], {
    cwd: process.cwd(), env: { ...cleanEnv, GH_RESTORE_EVIDENCE_PATH: symlinkEvidencePath },
    encoding: 'utf8', timeout: 30_000,
  })
  assert.equal(symlinkEvidence.error, undefined, `symlink-evidence gate failed to start: ${symlinkEvidence.error?.message ?? ''}`)
  assert.equal(symlinkEvidence.status, 2, `strict gate must reject a symlink evidence path; got ${symlinkEvidence.status}\n${symlinkEvidence.stdout}\n${symlinkEvidence.stderr}`)
  assert.match(`${symlinkEvidence.stdout}\n${symlinkEvidence.stderr}`, /non-symlink file/i)
  console.log('PASS strict release mode rejects symbolic-link evidence paths')
} finally { rmSync(tempDir, { recursive: true, force: true }) }

console.log('Phase 4 recovery release gate behavior: 5/5 passed')
