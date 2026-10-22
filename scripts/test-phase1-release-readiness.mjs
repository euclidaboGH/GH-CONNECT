#!/usr/bin/env node
/** Phase 1 guardrails: inventory drift, safe defaults, and Testnet E2E release gates. */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')
const checks = []
const check = (name, condition) => checks.push({ name, pass: Boolean(condition) })

const migrations = fs.readdirSync(path.join(root, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql'))
const checklist = read('docs/MIGRATION_CHECKLIST.md')
const manifest = read('VERIFIED_MANIFEST.txt')
const status = read('docs/PHASE_IMPLEMENTATION_STATUS.md')
const env = read('.env.example')
const workflow = read('.github/workflows/ci.yml')
const packageJson = JSON.parse(read('package.json'))

const inventoryCheck = spawnSync(process.execPath, ['scripts/generate-migration-inventory.mjs', '--check'], { cwd: root, encoding: 'utf8' })
check('duplicate migration versions fail closed with a clear blocker', inventoryCheck.status !== 0 && `${inventoryCheck.stdout || ''}${inventoryCheck.stderr || ''}`.includes('Duplicate Supabase migration version prefixes'))
check('migration checklist row count equals canonical SQL count', (checklist.match(/^\| \d+ \| `[^`]+\.sql` \|/gm) ?? []).length === migrations.length)
check('manifest count equals canonical SQL count', new RegExp(`^canonical_migrations=${migrations.length}$`, 'm').test(manifest))
check('phase status identifies current source and blocked release state', status.includes('0.69.3') && status.includes('not approved'))
check('messaging durable mode defaults off in local template', /^NEXT_PUBLIC_MESSAGING_DURABLE=false\b/m.test(env))
check('Testnet E2E skips are explicitly labeled not release evidence', workflow.includes('not release evidence') && workflow.includes('GHC_E2E_BASE_URL not set'))
check('CI records browser E2E skip as a warning, not a pass', workflow.includes('::warning::GHC_E2E_BASE_URL secret is not set') && workflow.includes('not release evidence'))
check('CI runs inventory consistency and Phase 1 guardrails', workflow.includes('npm run check:migration-inventory') && workflow.includes('node scripts/test-phase1-release-readiness.mjs'))
check('inventory consistency check is available as package script', packageJson.scripts['check:migration-inventory'] === 'node scripts/generate-migration-inventory.mjs --check')
check('runtime preflight is available and wired into CI', packageJson.scripts['check:runtime'] === 'node scripts/check-node-runtime.mjs' && workflow.includes('npm run check:runtime'))
check('runtime contract tests are registered', packageJson.scripts['test:runtime-contract'] === 'node scripts/test-node-runtime.mjs')
check('local CI helper checks runtime before dependency install', packageJson.scripts.ci.startsWith('npm run check:runtime && npm ci'))
check('live migration application is explicitly not implied by inventory', checklist.includes('does **not** prove that any migration is applied to Testnet or Mainnet'))

let failed = 0
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}`)
  if (!item.pass) failed++
}
console.log(`\nPHASE 1 RELEASE READINESS: ${checks.length - failed}/${checks.length} passed`)
if (failed) {
  if (inventoryCheck.stdout) process.stdout.write(inventoryCheck.stdout)
  if (inventoryCheck.stderr) process.stderr.write(inventoryCheck.stderr)
  process.exit(1)
}
