#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (file) => readFileSync(join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const provider = read('contexts/domains/wallet-read-provider.tsx')
const walletV2 = read('lib/domains/wallet-v2.ts')
const dashboard = read('components/ghc/unified-earnings-dashboard.tsx')
const balance = read('features/wallet/wallet-balance.tsx')
const screen = read('features/wallet/wallet-screen.tsx')
const context = read('docs/CURRENT_BUILD_CONTEXT.md')
const gitignore = read('.gitignore')
const checks = [
  ['wallet summary fetch has a bounded timeout', /AbortSignal\.timeout\(10_000\)/.test(walletV2)],
  ['wallet provider aborts superseded requests', /activeRequest\.current\?\.abort\(\)/.test(provider)],
  ['wallet provider clears timeout and active request', /clearTimeout\(timeout\)/.test(provider) && /activeRequest\.current = null/.test(provider)],
  ['wallet provider invalidates in-flight work on unmount', /requestSequence\.current \+= 1/.test(provider) && /activeRequest\.current\?\.abort\(\)/.test(provider)],
  ['PI earnings dashboard enforces a 10-second request bound', /setTimeout\(\(\) => controller\.abort\(\), 10_000\)/.test(dashboard)],
  ['PI earnings dashboard uses latest-request-wins sequencing', /refreshSequence\.current/.test(dashboard) && /refreshController\.current\?\.abort\(\)/.test(dashboard)],
  ['PI earnings dashboard aborts on unmount', /refreshController\.current\?\.abort\(\)/.test(dashboard)],
  ['wallet shows bounded ledger-check feedback rather than endless loading copy', /Checking ledger · up to 10 seconds/.test(balance) && !/Loading ledger…/.test(balance)],
  ['GHC balances are labelled confirmed only for server-sourced snapshots', /ghcVerified/.test(balance) && /source === "server"/.test(screen)],
  ['Pi and GHC remain distinct rails in the redesigned wallet', /PI and GHC are never added together/.test(balance) && /Pi · separate from GHC/.test(balance)],
  ['current build context explicitly supersedes historical prompts/worklogs', /CURRENT BUILD CONTEXT/.test(context) && /historical/.test(context.toLowerCase())],
  ['phase gate is registered in prebuild and verify:static', (pkg.scripts.prebuild || '').includes('check-phase26-wallet-ledger-resilience.mjs') && (pkg.scripts['verify:static'] || '').includes('check-phase26-wallet-ledger-resilience.mjs')],
  ['package and lockfile versions match', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version],
  ['wallet release gate remains registered', (pkg.scripts['verify:static'] || '').includes('check-wallet-phase5-release-gate.mjs')],
  ['no SQL migration added in this UI/reliability phase', existsSync(join(root, 'MIGRATION-SOURCE-MANIFEST.csv')) && read('MIGRATION-SOURCE-MANIFEST.csv').trim().split(/\r?\n/).length === 178],
  ['incremental build cache is excluded from source releases', !existsSync(join(root, 'tsconfig.tsbuildinfo')) && gitignore.includes('*.tsbuildinfo')],
  ['local secrets remain ignored while the example template is retained', gitignore.includes('.env.*') && gitignore.includes('!.env.example') && existsSync(join(root, '.env.example'))],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures++
}
console.log(`\nPhase 26 wallet-ledger resilience: ${checks.length - failures}/${checks.length} passed`)
process.exit(failures ? 1 : 0)
