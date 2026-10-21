#!/usr/bin/env node
/** Cross-phase wiring and release-truth contract. Static only; never a live deployment attestation. */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, relative, dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => readFileSync(join(root, name), 'utf8')
const pkg = JSON.parse(read('package.json'))
const ci = pkg.scripts?.['ci:verify'] ?? ''
const checks = []
const check = (label, ok) => checks.push({ label, ok: Boolean(ok) })

const requiredCiCommands = [
  'test:phase1-2-foundation', 'test:stabilization-phase3-security',
  'test:phase5-financial-integrity', 'test:phase6-media-messaging-realtime',
  'test:phase7-product-experience', 'test:phase8-architecture-quality',
  'test:phase9-operations-resilience', 'test:phase10-testnet-beta-gates',
  'test:essential-20', 'test:media-signed-url', 'test:media-direct',
  'test:ghc-pi-withdrawal-default-off', 'test:migration-history-reconciler',
]
for (const name of requiredCiCommands) check(`ci:verify runs ${name}`, ci.includes(`npm run ${name}`))

// All direct node script entrypoints must exist; catches dead npm wiring before install/build.
const missingScripts = []
for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
  const match = command.match(/(?:^|&&\s*)node\s+([\w./-]+\.mjs)/)
  if (match && !existsSync(join(root, match[1]))) missingScripts.push(`${name}: ${match[1]}`)
}
check('all direct npm node-script targets exist', missingScripts.length === 0)

// Check relative Markdown links and image targets within the repository.
const markdownFiles = []
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'coverage', 'playwright-report'].includes(item.name)) continue
    const full = join(dir, item.name)
    if (item.isDirectory()) walk(full)
    else if (extname(item.name).toLowerCase() === '.md') markdownFiles.push(full)
  }
}
walk(root)
const brokenLinks = []
for (const file of markdownFiles) {
  const body = readFileSync(file, 'utf8')
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g
  for (const match of body.matchAll(pattern)) {
    const raw = match[1].trim().split(/[?#]/, 1)[0]
    if (!raw || raw.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(raw)) continue
    const target = resolve(dirname(file), decodeURIComponent(raw))
    const rel = relative(root, target)
    if (rel.startsWith('..') || !existsSync(target)) brokenLinks.push(`${relative(root, file)} -> ${raw}`)
  }
}
check('repository-relative Markdown links resolve', brokenLinks.length === 0)

// Current inventory is authoritative only as source inventory, never remote application evidence.
const migrations = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'))
const manifest = read('VERIFIED_MANIFEST.txt')
const migrationChecklist = read('docs/MIGRATION_CHECKLIST.md')
check('migration inventory is present and reflected in manifest', migrations.length > 0 && manifest.includes(String(migrations.length)))
check('migration checklist preserves explicit review classifications', /REQUIRED/.test(migrationChecklist) && /REVIEW_REQUIRED/.test(migrationChecklist) && /PROPOSAL/.test(migrationChecklist))

const testnetGate = read('docs/TESTNET_VERIFICATION_GATE.md')
const phase10 = read('docs/PHASE_10_TESTNET_BETA_LAUNCH_APPROVAL.md')
const releasePolicy = read('lib/server/release/stage7-readiness.ts')
check('Testnet gate prohibits blind migration application', /apply individually on Testnet/i.test(testnetGate) && /Reconcile target migration history/i.test(testnetGate))
check('Phase 10 remains blocked until evidence and approval', /NOT APPROVED/i.test(phase10) && /not_release_approved/.test(releasePolicy))
check('financial features remain disabled by default in release policy', /financialFeaturesEnabled:\s*false/.test(releasePolicy))
check('no private local env file is accidentally tracked in source tree', !['.env', '.env.local', '.env.production', '.env.test'].some((name) => existsSync(join(root, name))))

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}`)
if (missingScripts.length) console.error('Missing script targets:\n' + missingScripts.join('\n'))
if (brokenLinks.length) console.error('Broken relative links:\n' + brokenLinks.join('\n'))
const failed = checks.filter((item) => !item.ok)
console.log(`\nPhase 1–10 integration audit: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
