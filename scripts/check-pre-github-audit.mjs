#!/usr/bin/env node
/** Read-only release audit guard. Checks source inventory and release contracts; never contacts external systems. */
import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.posix.join(dir, e.name)) : [path.posix.join(dir, e.name)])
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const ci = read('.github/workflows/ci.yml')
const truth = read('docs/PROJECT_TRUTH.md')
const installer = read('supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql')
const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
const versionGroups = new Map()
for (const f of migrations) {
  const m = f.match(/^(\d{14})_/)
  if (!m) continue
  versionGroups.set(m[1], [...(versionGroups.get(m[1]) || []), f])
}
const duplicateVersions = [...versionGroups].filter(([, files]) => files.length > 1)
const envFiles = walk('.').filter((f) => /(^|\/)\.env(?:\.|$)/.test(f) && !/(^|\/)\.env\.example$/.test(f) && !f.includes('node_modules/'))
const routeFiles = walk('app/api').filter((f) => /\/route\.(ts|tsx|js|jsx)$/.test(f))
const workflowPinned = /node-version:\s*24\.15\.0/.test(ci) && /npm ci --legacy-peer-deps/.test(ci)
const checks = [
  ['package and lock root versions match', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version],
  ['runtime pin agrees with package engine', fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim() === '24.15.0' && String(pkg.engines?.node || '').includes('24.15.0')],
  ['CI installs the locked dependency graph under pinned Node 24.15.0', workflowPinned],
  ['canonical migration files use unique 14-digit versions', migrations.length > 0 && migrations.every((f) => /^\d{14}_.*\.sql$/.test(f)) && duplicateVersions.length === 0],
  ['migration source manifest and consolidated bundle are present', exists('MIGRATION-SOURCE-MANIFEST.csv') && exists('supabase/GH-CONNECT-CANONICAL-MIGRATION-BUNDLE-0.274.3.sql')],
  ['legacy installer is explicitly marked stale/do-not-execute', /STALE/i.test(installer) && /DO NOT EXECUTE/i.test(installer)],
  ['repository tree contains no real .env secrets files', envFiles.length === 0],
  ['CI includes static verification, typecheck, lint and build gates', /npm run verify:static/.test(ci) && /npm run typecheck/.test(ci) && /npm run lint/.test(ci) && /npm run build/.test(ci)],
  ['release truth explicitly blocks production until runtime/live gates pass', /NOT APPROVED/.test(truth) && /TypeScript, lint, and Next\.js production build/.test(truth)],
  ['API routes and ten core product/system domains are present', routeFiles.length > 0 && ['features/wallet','components/ghc','lib/server','supabase/migrations','docs','scripts','app/api','app','public',' .github/workflows'.trim()].every(exists)],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`\nPre-GitHub source audit guard: ${checks.length - failures}/${checks.length} passed`)
console.log(`Inventory: ${routeFiles.length} API route files; ${migrations.length} canonical migrations; ${walk('.').length} tracked-tree files (excluding no paths automatically).`)
if (duplicateVersions.length) console.error(`Duplicate versions: ${JSON.stringify(duplicateVersions)}`)
if (envFiles.length) console.error(`Unexpected env files: ${envFiles.join(', ')}`)
if (failures) process.exit(1)
