#!/usr/bin/env node
/** Phase 17 CI governance contracts. Source-only; does not contact external services. */
import fs from 'node:fs'
import path from 'node:path'
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const workflow = read('.github/workflows/ci.yml')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const manifest = read('VERIFIED_MANIFEST.txt')
const checks = [
  ['workflow uses supported Node 24.15.0 runtime', /node-version:\s*24\.15\.0/.test(workflow)],
  ['dependency lock integrity runs before dependency installation', workflow.indexOf('node scripts/check-dependency-lock-integrity.mjs') >= 0 && workflow.indexOf('node scripts/check-dependency-lock-integrity.mjs') < workflow.indexOf('npm ci --legacy-peer-deps')],
  ['CI installs from the lockfile with npm ci', /npm ci --legacy-peer-deps/.test(workflow) && !/npm install\s/.test(workflow)],
  ['CI checks bounded JSON runtime behavior', /npm run test:bounded-json-runtime/.test(workflow)],
  ['CI checks request-boundary follow-up contracts', /check-phase1-12-request-boundary-followup\.mjs/.test(workflow)],
  ['CI checks database RLS coverage and SECURITY DEFINER ACLs', /check-database-rls-coverage\.mjs/.test(workflow) && /check-security-definer-acl\.mjs/.test(workflow)],
  ['CI checks marketplace integrity and cross-feature wallet reconciliation', /check-phase10-marketplace-integrity\.mjs/.test(workflow) && /check-phase11-wallet-cross-feature-reconciliation\.mjs/.test(workflow)],
  ['CI checks treasury, payout recovery and payment lifecycle contracts', /check-phase7-treasury-completion\.mjs/.test(workflow) && /check:phase15-payment-recovery/.test(workflow) && /check:phase16-payment-timeline/.test(workflow)],
  ['CI executes Phase 18 payment binding and Phase 19 RPC transport gates', /check:phase18-marketplace-payment-binding/.test(workflow) && /check:phase19-marketplace-rpc-transport/.test(workflow)],
  ['CI includes typecheck, lint and production build as separate gates', /npm run typecheck/.test(workflow) && /npm run lint/.test(workflow) && /npm run build/.test(workflow)],
  ['CI uses read-only repository permissions by default', /permissions:\s*\n\s*contents:\s*read/.test(workflow)],
  ['CI cancels superseded runs for the same ref', /cancel-in-progress:\s*true/.test(workflow)],
  ['CI is triggered for pushes, pull requests and manual dispatch', /push:/.test(workflow) && /pull_request:/.test(workflow) && /workflow_dispatch:/.test(workflow)],
  ['CI does not print environment secrets or grant write permissions', !/printenv|env\s*\|\s*sort|secrets\.[A-Z0-9_]+\s*\}\}/i.test(workflow) && !/permissions:[\s\S]{0,120}contents:\s*write/.test(workflow)],
  ['package, lockfile and app release versions agree', pkg.version === lock.version && lock.packages?.['']?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['verified manifest identifies the current release', manifest.includes(`project_version=${pkg.version}`)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 17 CI governance: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
