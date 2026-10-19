import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const read = (p) => fs.readFileSync(path.resolve(p), 'utf8')
const pkg = JSON.parse(read('package.json'))
const audit = read('scripts/audit-project-integrity.mjs')
const nextConfig = read('next.config.mjs')
const vercel = read('vercel.json')
const workflow = read('.github/workflows/ci.yml')
const lockRepairWorkflow = read('.github/workflows/repair-npm-lock.yml')
const gitignore = read('.gitignore')
const nvm = read('.nvmrc').trim()
const readiness = read('lib/server/readiness.ts')
const checks = [
  ['repository audit has a stable npm entry point', pkg.scripts['audit:project-integrity'] === 'node scripts/audit-project-integrity.mjs'],
  ['CI verification runs audit before the lockfile gate', pkg.scripts['ci:verify'].startsWith('npm run audit:project-integrity && npm run check:dependency-lock-integrity')],
  ['GitHub Actions exposes structural findings before dependency preflight', workflow.indexOf('npm run audit:project-integrity') >= 0 && workflow.indexOf('npm run audit:project-integrity') < workflow.indexOf('node scripts/check-dependency-lock-integrity.mjs')],
  ['audit checks local imports and npm script targets', audit.includes('all local source imports resolve') && audit.includes('all npm script file targets exist')],
  ['audit checks literal internal links and deployment config', audit.includes('literal internal navigation targets resolve') && audit.includes('Vercel build command')],
  ['audit checks secret and generated-file exclusions', audit.includes('no local environment secret files') && audit.includes('generated compiler/log/OS artifacts')],
  ['global CSP is configured in Vercel only', vercel.includes('Content-Security-Policy') && !nextConfig.includes('Content-Security-Policy')],
  ['Git ignores Vercel output, environment files, and compiler artifacts', gitignore.includes('.vercel/') && gitignore.includes('.env*') && gitignore.includes('*.tsbuildinfo')],
  ['Git ignores common local signing-key containers', ['*.pem', '*.p12', '*.pfx', '*.jks', '*.keystore'].every((entry) => gitignore.includes(entry))],
  ['release metadata is not hard-coded to an old patch version', !audit.includes('0.62.4') && audit.includes('APP_RELEASE_VERSION')],
  ['health endpoint release fallback does not report stale 0.59.4', readiness.includes('version: process.env.npm_package_version || APP_RELEASE_VERSION') && !readiness.includes('0.59.4')],
  ['local and CI Node versions match the supported runtime', nvm === '24.15.0' && read('.github/workflows/ci.yml').includes('node-version: "24.15.0"')],
  ['deployment runbook does not direct users to add validation secrets', !read('VERCEL_DEPLOY.txt').includes('DOMAIN_VALIDATION_KEY=') && read('VERCEL_DEPLOY.txt').includes('/validation-key.txt')],
  ['official Pi SDK lock verifier is part of release checks', pkg.scripts['check:pi-backend-lock'] === 'node scripts/verify-pi-backend-lock.mjs' && pkg.scripts['ci:verify'].includes('npm run check:pi-backend-lock')],
  ['lock repair is manually triggered and opens a lockfile-only review PR', lockRepairWorkflow.includes('workflow_dispatch:') && lockRepairWorkflow.includes('add-paths: package-lock.json') && lockRepairWorkflow.includes('npm run ci:verify')],
]
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); assert.ok(pass, name) }
console.log(`\nProject integrity audit regression checks: ${checks.length}/${checks.length} passed.`)
