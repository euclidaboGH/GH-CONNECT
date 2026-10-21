import { spawnSync } from 'node:child_process'

const result = spawnSync(process.execPath, ['scripts/check-project-truth.mjs'], {
  encoding: 'utf8',
  timeout: 15000,
})
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) {
  console.error(`FAIL project truth check could not execute: ${result.error.message}`)
  process.exit(1)
}
if (result.status !== 0) {
  console.error(`FAIL project truth check exited with status ${result.status}`)
  process.exit(result.status ?? 1)
}
console.log('PASS project truth regression contract')
