#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const script = join(root, 'scripts', 'reconcile-remote-migration-histories.mjs')
const tmp = mkdtempSync(join(tmpdir(), 'gh-migration-reconcile-'))
try {
  const testnet = join(tmp, 'testnet.txt')
  const mainnet = join(tmp, 'mainnet.txt')
  const report = join(tmp, 'report.md')
  writeFileSync(testnet, `\n Local | Remote | Time (UTC)\n-------|--------|----------\n 20261017 | 20261017 | 2026-10-17\n 20261018 | - | -\n 20260821 | 20260821 | 2026-08-21\n`)
  writeFileSync(mainnet, `\n Local | Remote | Time (UTC)\n-------|--------|----------\n 20261017 | - | -\n 20260821 | 20260821 | 2026-08-21\n 20260901 | 20260901 | 2026-09-01\n`)
  const result = spawnSync(process.execPath, [script, '--testnet', testnet, '--mainnet', mainnet, '--out', report], { encoding: 'utf8' })
  assert.equal(result.status, 0, `expected unique local migration versions to reconcile without a local-collision block; got ${result.status}: ${result.stderr}`)
  const output = readFileSync(report, 'utf8')
  assert.match(output, /202610170001_ghpv_settlement_engine\.sql/)
  assert.match(output, /202610170002_match_signals_durable\.sql/)
  assert.match(output, /202610180012_gh_engagement_rosters\.sql/)
  assert.match(output, /202610170003_ghpv_calibration_bounds\.sql/)
  assert.match(output, /No duplicate local numeric prefixes/)
  assert.match(output, /Version present remotely; checksum\/body not verified/)
  assert.match(output, /Remote versions absent from local filenames: 1/)
  assert.match(output, /Version present remotely; checksum\/body not verified/)
  console.log('Migration history reconciler tests: PASS (unique local versions, per-environment remote state, remote-only versions, content-hash limitation).')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
