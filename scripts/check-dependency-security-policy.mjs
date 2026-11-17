#!/usr/bin/env node
/** Regression guard for automated dependency advisory collection and update policy. */
import { readFileSync, existsSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const workflowPath = '.github/workflows/dependency-security.yml'
const dependabotPath = '.github/dependabot.yml'
const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : ''
const dependabot = existsSync(dependabotPath) ? readFileSync(dependabotPath, 'utf8') : ''
const checks = [
  ['dependency audit workflow exists', Boolean(workflow)],
  ['audit runs on PRs and protected branches', /pull_request:[\s\S]*branches:\s*\[main, master, testnet\]/.test(workflow) && /push:[\s\S]*branches:\s*\[main, master, testnet\]/.test(workflow)],
  ['audit uses the required Node 24.15.0 runtime', /node-version:\s*24\.15\.0/.test(workflow)],
  ['audit performs deterministic npm ci', /npm ci --legacy-peer-deps/.test(workflow)],
  ['audit saves complete JSON report as artifact', /npm audit --json/.test(workflow) && /path:\s*npm-audit\.json/.test(workflow)],
  ['audit blocks releases when findings remain', /zero known vulnerabilities/.test(workflow) && /if \(total > 0\)/.test(workflow)],
  ['Dependabot updates npm dependencies weekly', /package-ecosystem: npm/.test(dependabot) && /interval: weekly/.test(dependabot)],
  ['Dependabot updates GitHub Actions weekly', /package-ecosystem: github-actions/.test(dependabot)],
]
let failed = 0
for (const [label, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`)
  if (!pass) failed++
}
console.log(`\nDependency security policy: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
