#!/usr/bin/env node
/** Behavioral tests for the offline restore evidence validator. */
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const dir = mkdtempSync(join(tmpdir(), 'gh-restore-evidence-'))
const validator = resolve('scripts/validate-database-restore-evidence.mjs')
const base = {
  schema_version: 1, environment: 'disposable', production_credentials_used: false,
  backup_sha256: 'a'.repeat(64), postgres_version: '16.4',
  restore_started_at: '2026-10-27T10:00:00Z', restore_finished_at: '2026-10-27T10:05:00Z', restore_status: 'pass',
  integrity_checks: [{ name: 'catalog', status: 'pass' }, { name: 'ledger reconciliation', status: 'pass' }],
  smoke_tests: [{ name: 'profile read', status: 'pass' }, { name: 'wallet fixture', status: 'pass' }],
  actual_rpo_seconds: 3600, actual_rto_seconds: 1800,
  review: { reviewer_role: 'independent reviewer', reviewed_at: '2026-10-27T10:10:00Z' },
}
const cases = [
  ['valid complete evidence accepted', base, true],
  ['not-run integrity check rejected for passing report', { ...base, integrity_checks: [{ name: 'catalog', status: 'not_run' }] }, false],
  ['not-run smoke test rejected for passing report', { ...base, smoke_tests: [{ name: 'smoke', status: 'not_run' }] }, false],
  ['missing measured RPO rejected for passing report', { ...base, actual_rpo_seconds: null }, false],
  ['missing measured RTO rejected for passing report', { ...base, actual_rto_seconds: null }, false],
  ['review before restore completion rejected', { ...base, review: { reviewer_role: 'independent reviewer', reviewed_at: '2026-10-27T10:01:00Z' } }, false],
  ['timezone-free timestamp rejected', { ...base, restore_started_at: '2026-10-27T10:00:00' }, false],
  ['impossible calendar date rejected', { ...base, restore_started_at: '2026-02-30T10:00:00Z' }, false],
  ['out-of-range clock time rejected', { ...base, restore_started_at: '2026-10-27T25:00:00Z' }, false],
  ['out-of-range timezone offset rejected', { ...base, restore_started_at: '2026-10-27T10:00:00+15:00' }, false],
  ['duplicate integrity check names rejected', { ...base, integrity_checks: [{ name: 'catalog', status: 'pass' }, { name: 'CATALOG', status: 'pass' }] }, false],
  ['duplicate smoke test names rejected', { ...base, smoke_tests: [{ name: 'profile read', status: 'pass' }, { name: 'Profile Read', status: 'pass' }] }, false],
  ['non-independent reviewer label rejected', { ...base, review: { reviewer_role: 'same operator', reviewed_at: '2026-10-27T10:10:00Z' } }, false],
  ['unrecognizable PostgreSQL version rejected', { ...base, postgres_version: 'latest' }, false],
  ['production credential use rejected', { ...base, production_credentials_used: true }, false],
  ['credential-bearing field rejected', { ...base, nested: { password: 'redacted' } }, false],
  ['raw PostgreSQL connection URL rejected even under a generic field name', { ...base, operator_note: 'postgresql://operator:example@db.example.invalid/app' }, false],
  ['bearer token rejected even under a generic field name', { ...base, operator_note: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature' }, false],
  ['compact JWT rejected without a Bearer prefix', { ...base, operator_note: 'eyJhbGciOiJIUzI1NiJ9.abcdefghij.klmnopqrst' }, false],
  ['API key field rejected even when value appears redacted', { ...base, api_key: '[REDACTED]' }, false],
  ['URL userinfo credentials rejected', { ...base, operator_note: 'https://operator:example@host.example.invalid/logs' }, false],
  ['private key material rejected', { ...base, operator_note: '-----BEGIN PRIVATE KEY-----\nredacted\n-----END PRIVATE KEY-----' }, false],
  ['GitHub token rejected in generic note', { ...base, operator_note: 'ghp_' + 'A'.repeat(36) }, false],
  ['GitHub fine-grained token rejected in generic note', { ...base, operator_note: 'github_pat_' + 'B'.repeat(30) }, false],
  ['Stripe-like secret token rejected in generic note', { ...base, operator_note: 'sk_live_' + 'c'.repeat(24) }, false],
  ['AWS access key ID rejected in generic note', { ...base, operator_note: 'AKIA1234567890ABCDEF' }, false],
  ['URL query access token rejected', { ...base, operator_note: 'https://logs.example.invalid/view?access_token=eyJsecretvalue' }, false],
  ['URL query API key rejected', { ...base, operator_note: 'https://logs.example.invalid/view?api_key=supersecretvalue' }, false],
  ['malformed digest rejected', { ...base, backup_sha256: 'not-a-digest' }, false],
  ['failed restore rejected', { ...base, restore_status: 'fail' }, false],
]
let failed = 0
try {
  for (const [name, record, expectedPass] of cases) {
    const file = join(dir, 'evidence.json')
    writeFileSync(file, JSON.stringify(record))
    const result = spawnSync(process.execPath, [validator, file], { encoding: 'utf8' })
    const actualPass = result.status === 0
    const ok = actualPass === expectedPass
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
    if (!ok) { failed++; console.log((result.stdout || '') + (result.stderr || '')) }
  }
  const arrayFile = join(dir, 'array.json')
  writeFileSync(arrayFile, '[]')
  const arrayResult = spawnSync(process.execPath, [validator, arrayFile], { encoding: 'utf8' })
  const arrayOk = arrayResult.status !== 0 && /top-level JSON value must be an object/.test(arrayResult.stderr)
  console.log(`${arrayOk ? 'PASS' : 'FAIL'} top-level JSON array rejected`)
  if (!arrayOk) failed++
  const symlinkTarget = join(dir, 'symlink-target.json')
  const symlinkPath = join(dir, 'evidence-link.json')
  writeFileSync(symlinkTarget, JSON.stringify(base))
  symlinkSync(symlinkTarget, symlinkPath)
  const symlinkResult = spawnSync(process.execPath, [validator, symlinkPath], { encoding: 'utf8' })
  const symlinkOk = symlinkResult.status !== 0 && /non-symlink file/.test(symlinkResult.stderr)
  console.log(`${symlinkOk ? 'PASS' : 'FAIL'} symbolic-link evidence rejected`)
  if (!symlinkOk) failed++
  const hugeFile = join(dir, 'huge.json')
  writeFileSync(hugeFile, ' '.repeat(256 * 1024 + 1))
  const hugeResult = spawnSync(process.execPath, [validator, hugeFile], { encoding: 'utf8' })
  const hugeOk = hugeResult.status !== 0 && /exceeds 256 KiB limit/.test(hugeResult.stderr)
  console.log(`${hugeOk ? 'PASS' : 'FAIL'} oversized evidence rejected before JSON parsing`)
  if (!hugeOk) failed++
} finally { rmSync(dir, { recursive: true, force: true }) }
console.log(`Restore evidence validator behavior: ${cases.length + 3 - failed}/${cases.length + 3} passed`)
if (failed) process.exit(1)
