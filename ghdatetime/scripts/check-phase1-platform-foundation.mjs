#!/usr/bin/env node
/** Network/DB-independent Phase 1 platform, configuration and security baseline. */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const vercel = JSON.parse(read('vercel.json'))
const envExample = read('.env.example')
const ci = read('.github/workflows/ci.yml')
const tsconfig = JSON.parse(read('tsconfig.json'))
const staticRunner = read('scripts/verify-phase14-static.mjs')
function countFiles(dir, predicate) {
  let total = 0
  for (const name of readdirSync(join(root, dir))) {
    const path = join(root, dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) total += countFiles(join(dir, name), predicate)
    else if (predicate(name)) total++
  }
  return total
}
const routes = countFiles('app/api', (name) => name === 'route.ts' || name === 'route.js')
const migrations = countFiles('supabase/migrations', (name) => name.endsWith('.sql'))
const globalHeaders = vercel.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? []
const headerMap = new Map(globalHeaders.map(({ key, value }) => [key.toLowerCase(), value]))
const checks = [
  ['package, lockfile root and supported runtime contract agree', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version && pkg.engines?.node === '^24.15.0' && read('.nvmrc').trim() === '24.15.0'],
  ['runtime preflight runs before build, lint and typecheck', (pkg.scripts?.prebuild ?? '').includes('check-node-runtime.mjs') && (pkg.scripts?.prelint ?? '').includes('check-node-runtime.mjs') && (pkg.scripts?.pretypecheck ?? '').includes('check-node-runtime.mjs')],
  ['CI pins the supported Node runtime and runs locked install', /node-version:\s*24\.15\.0/.test(ci) && /npm ci --legacy-peer-deps --no-audit/.test(ci)],
  ['TypeScript strictness remains enabled', tsconfig.compilerOptions?.strict === true],
  ['deployment globally disables MIME sniffing', headerMap.get('x-content-type-options') === 'nosniff'],
  ['deployment has restrictive referrer and transport policies', headerMap.get('referrer-policy') === 'strict-origin-when-cross-origin' && /^max-age=31536000(?:;|$)/.test(headerMap.get('strict-transport-security') ?? '')],
  ['deployment explicitly constrains framing and browser capabilities', (headerMap.get('content-security-policy') ?? '').includes('frame-ancestors') && Boolean(headerMap.get('permissions-policy'))],
  ['environment template contains placeholders rather than configured secrets', envExample.split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line)).every((line) => /^[A-Z][A-Z0-9_]*=(?:|0|1)$/.test(line))],
  ['migration and API route inventories are discoverable', routes > 0 && migrations > 0],
  ['Phase 1 foundation gate is registered in static verification', staticRunner.includes('check-phase1-platform-foundation.mjs')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 1 platform foundation: ${checks.length - failed}/${checks.length} passed`)
console.log(`Inventory snapshot: ${routes} API route files; ${migrations} SQL migration files`)
if (failed) process.exit(1)
