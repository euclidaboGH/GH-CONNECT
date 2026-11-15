#!/usr/bin/env node
/** Run #300: release identity, CI safety and Vercel upload integrity. */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const read = (p) => readFileSync(p, 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const ci = read('.github/workflows/ci.yml')
const closure = read('scripts/check-phase10-release-closure.mjs')
const phasePack = read('scripts/check-phase1-10-upgrade-pack.mjs')
const truth = read('docs/PROJECT_TRUTH.md')
const audit = read('docs/PHASE-1-CONSOLIDATED-AUDIT-AND-IMPLEMENTATION-REGISTER-2026-11-09.md')
const manifest = read('VERIFIED_MANIFEST.txt')
const release = read('lib/app-release.ts')
const ignore = read('.vercelignore').split(/\r?\n/).map((x) => x.trim())
const workflows = readdirSync('.github/workflows').filter((x) => /\.ya?ml$/i.test(x)).map((x) => [x, read(join('.github/workflows', x))])
const allWorkflows = workflows.map(([name, body]) => `# ${name}\n${body}`).join('\n')
const checks = []
const add = (name, ok) => checks.push({ name, ok: Boolean(ok) })
const excluded = (name) => ignore.includes(name)

// 1–7: release identity must be synchronized across authoritative metadata.
add('package and lockfile versions agree', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version)
add('in-app release identity matches package version', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`))
add('README identifies the current package version', read('README.md').includes(`Current source version:** \`${pkg.version}\``))
add('project truth identifies the current package version', truth.includes(`Current source version:** \`${pkg.version}\``))
add('verified manifest identifies the current package version', manifest.includes(`project_version=${pkg.version}`))
add('Phase 1 audit identifies the current package identity', audit.includes(`gh-connect@${pkg.version}`))
add('phase-10 closure uses case-insensitive no-go assertion', /NOT APPROVED\/i/.test(closure))

// 8–14: CI must remain static, least-privilege and migration-safe.
add('P10-B contract checks the production no-go case-insensitively', /NOT APPROVED\/i\.test\(releaseClosure\)/.test(phasePack))
add('GitHub workflow inventory is non-empty and readable', workflows.length > 0 && workflows.every(([, body]) => body.length > 0))
add('no workflow applies Supabase migrations', !/supabase\s+db\s+push/i.test(allWorkflows))
add('no workflow applies Prisma migrations', !/prisma\s+migrate\s+deploy/i.test(allWorkflows))
add('no workflow pushes Drizzle schema changes', !/drizzle-kit\s+push/i.test(allWorkflows))
add('no workflow automatically deploys Vercel production', !/vercel\s+(?:deploy\s+)?--prod\b/i.test(allWorkflows))
add('workflow permissions remain read-only for repository contents', /permissions:\s*\n\s+contents:\s*read/m.test(ci))

// 15–17: CI installation and build provenance.
add('untrusted pull_request_target trigger is absent', !/^\s*pull_request_target:/m.test(allWorkflows))
add('CI uses exact Node 24.15.0 in static and build jobs', (ci.match(/node-version:\s*24\.15\.0/g) || []).length === 2)
add('dependency lock integrity runs before npm ci', ci.indexOf('check-dependency-lock-integrity.mjs') >= 0 && ci.indexOf('check-dependency-lock-integrity.mjs') < ci.indexOf('npm ci'))

// 18–20: Vercel must receive source, not local build/dependency/secrets.
add('Vercel excludes node_modules from upload', excluded('node_modules') && excluded('node_modules/**'))
add('Vercel excludes Next and Vercel local caches', excluded('.next') && excluded('.next/**') && excluded('.vercel') && excluded('.vercel/**'))
add('Vercel excludes local environment files and archives', excluded('.env*') && excluded('*.zip') && excluded('*.tar.gz'))

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} Run #300: ${c.name}`)
const failed = checks.filter((x) => !x.ok)
console.log(`\nRun #300 release integrity: ${checks.length - failed.length}/${checks.length} passed; ${failed.length} failed.`)
if (failed.length) process.exit(1)
