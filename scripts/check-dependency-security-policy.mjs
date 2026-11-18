#!/usr/bin/env node
/** Regression guard for automated dependency advisory collection and update policy. */
import { readFileSync, existsSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const workflowPath = '.github/workflows/dependency-security.yml'
const dependabotPath = '.github/dependabot.yml'
const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : ''
const dependabot = existsSync(dependabotPath) ? readFileSync(dependabotPath, 'utf8') : ''
const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
const workflows = [workflow, ci]
const actionRefs = workflows.flatMap((source) => [...source.matchAll(/^\s*-\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)].map((match) => match[1]))
const checkoutCount = workflows.reduce((count, source) => count + [...source.matchAll(/^\s*-\s*uses:\s*actions\/checkout@[0-9a-f]{40}.*$/gm)].length, 0)
const checkoutCredentialOptOutCount = workflows.reduce((count, source) => count + [...source.matchAll(/uses:\s*actions\/checkout@[0-9a-f]{40}[\s\S]{0,100}?persist-credentials:\s*false/g)].length, 0)
const checks = [
  ['dependency audit workflow exists', Boolean(workflow)],
  ['audit runs on PRs and protected branches', /pull_request:[\s\S]*branches:\s*\[main, master, testnet\]/.test(workflow) && /push:[\s\S]*branches:\s*\[main, master, testnet\]/.test(workflow)],
  ['audit uses the required Node 24.15.0 runtime', /node-version:\s*24\.15\.0/.test(workflow)],
  ['audit performs deterministic npm ci', /npm ci --legacy-peer-deps/.test(workflow)],
  ['audit saves complete JSON report as artifact', /npm audit --json/.test(workflow) && /path:\s*npm-audit\.json/.test(workflow)],
  ['audit blocks releases when findings remain', /zero known vulnerabilities/.test(workflow) && /if \(total > 0\)/.test(workflow)],
  ['Dependabot updates npm dependencies weekly', /package-ecosystem: npm/.test(dependabot) && /interval: weekly/.test(dependabot)],
  ['Dependabot updates GitHub Actions weekly', /package-ecosystem: github-actions/.test(dependabot)],
  ['all GitHub Actions are pinned to immutable 40-character commit SHAs', actionRefs.length > 0 && actionRefs.every((ref) => /^[^@]+@[0-9a-f]{40}$/.test(ref))],
  ['checkout does not persist the GitHub token', checkoutCount > 0 && checkoutCredentialOptOutCount === checkoutCount],
  ['npm audit distinguishes vulnerability exit 1 from registry/report errors and still fails closed', /AUDIT_EXIT/.test(workflow) && /audit_exit/.test(workflow) && /report\.error/.test(workflow) && /counts\.total/.test(workflow) && /if \(total > 0\)/.test(workflow) && /process\.exit\(1\)/.test(workflow)],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`\nDependency security policy: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
