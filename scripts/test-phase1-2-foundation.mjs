#!/usr/bin/env node
/** Stabilization Phases 1–2: build reproducibility and current project truth. Static only. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const workflow = read('.github/workflows/ci.yml')
const readme = read('README.md')
const truth = read('docs/PROJECT_TRUTH.md')
const status = read('docs/PHASE_IMPLEMENTATION_STATUS.md')
const gate = read('docs/TESTNET_VERIFICATION_GATE.md')
const checklist = read('docs/MIGRATION_CHECKLIST.md')
const manifest = read('VERIFIED_MANIFEST.txt')
const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((n) => n.endsWith('.sql'))
const rows = [...checklist.matchAll(/^\|\s*\d+\s*\|\s*`[^`]+\.sql`\s*\|\s*(REQUIRED|REQUIRES_APPROVAL|PROPOSAL|REVIEW_REQUIRED)\s*\|/gm)]
const classes = ['REQUIRED', 'REQUIRES_APPROVAL', 'PROPOSAL', 'REVIEW_REQUIRED']
const counts = Object.fromEntries(classes.map((k) => [k, rows.filter((m) => m[1] === k).length]))
const checks = []
const check = (label, ok) => checks.push({ label, ok: Boolean(ok) })
check('package, lockfile and app release versions match', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version && read('lib/app-release.ts').includes(`"${pkg.version}"`))
check('supported Node engine and pin align', pkg.engines?.node === '^22.22.2 || ^24.15.0' && read('.nvmrc').trim() === '24.15.0')
check('typecheck fails fast on unsupported Node', pkg.scripts.pretypecheck === 'node scripts/check-node-runtime.mjs')
check('lint fails fast on unsupported Node', pkg.scripts.prelint === 'node scripts/check-node-runtime.mjs')
check('build runtime preflight precedes JSX safety', pkg.scripts.prebuild === 'node scripts/check-node-runtime.mjs && node scripts/check-jsx-safety.mjs')
check('aggregate CI includes Phase 1–2 foundation contract', pkg.scripts['ci:verify']?.includes('npm run test:phase1-2-foundation'))
check('CI uses supported Node and runtime preflight', workflow.includes('node-version: "24.15.0"') && workflow.includes('name: Node runtime preflight'))
check('Testnet E2E cannot silently skip without configured URL', workflow.includes('GHC_E2E_BASE_URL is required for the Testnet branch release gate'))
check('production smoke includes runtime and lock preflights', workflow.includes('name: Dependency lock preflight') && workflow.includes('name: Production smoke'))
check('canonical migrations match generated checklist', migrations.length === 109 && rows.length === migrations.length && checklist.includes(`**${migrations.length}**`))
check('migration classifications are internally consistent', counts.REQUIRED === 77 && counts.REQUIRES_APPROVAL === 1 && counts.PROPOSAL === 2 && counts.REVIEW_REQUIRED === 29 && Object.values(counts).reduce((a, b) => a + b, 0) === migrations.length)
check('Testnet gate reflects current migration count and classes', gate.includes(`Canonical on-disk count: **${migrations.length}**`) && gate.includes(`**${counts.REVIEW_REQUIRED} REVIEW_REQUIRED**`))
check('project truth reflects current migration inventory', truth.includes(`${migrations.length} canonical SQL files`) && truth.includes(`${counts.REVIEW_REQUIRED} \`REVIEW_REQUIRED\``))
check('phase status reflects canonical migration count', status.includes(`(canonical files on disk) | **${migrations.length}** |`))
check('manifest version and migration inventory match source', manifest.includes(`project_version=${pkg.version}`) && manifest.includes(`canonical_migrations=${migrations.length}`))
check('Pi SDK package and lock entries have a verifier', pkg.dependencies?.['pi-backend'] === '0.1.3' && lock.packages?.['node_modules/pi-backend']?.version === '0.1.3' && fs.existsSync(path.join(root, 'scripts/verify-pi-backend-lock.mjs')))
check('README does not claim the Pi SDK lock graph is currently missing', !readme.includes('dependency graph is still missing from `package-lock.json`') && !readme.includes('dependency graph is still missing from the lockfile'))
check('release authority separates source inventory from launch approval', truth.includes('not proof of remote application') && truth.toLowerCase().includes('not certified / not approved'))
let failed = 0
for (const item of checks) { console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}`); if (!item.ok) failed++ }
console.log(`\nPHASE 1–2 FOUNDATION: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
