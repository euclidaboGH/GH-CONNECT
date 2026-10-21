#!/usr/bin/env node
/** Contract tests for the supported Node.js runtime guard. */
import { spawnSync } from 'node:child_process'

const cases = [
  ['v22.22.2', true],
  ['v22.22.3', true],
  ['v24.15.0', true],
  ['v24.15.1', true],
  ['v22.16.0', false],
  ['v22.22.1', false],
  ['v23.0.0', false],
  ['v24.14.9', false],
  ['v25.0.0', false],
  ['not-a-version', false],
]
let failed = 0
for (const [version, expected] of cases) {
  const result = spawnSync(process.execPath, ['scripts/check-node-runtime.mjs', '--version', version], { encoding: 'utf8' })
  const passed = (result.status === 0) === expected
  console.log(`${passed ? 'PASS' : 'FAIL'} ${version} ${expected ? 'accepted' : 'rejected'}`)
  if (!passed) {
    failed++
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  }
}
console.log(`\nNODE RUNTIME CONTRACT: ${cases.length - failed}/${cases.length} passed`)
if (failed) process.exit(1)
