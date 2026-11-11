#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const context = readFileSync('contexts/ghc-context.tsx', 'utf8')
const hook = readFileSync('hooks/usePermissions.ts', 'utf8')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const checks = [
  ['GHC context contract is exported for typed consumers', /^export interface GHCContextType\s*\{/m.test(context)],
  ['permission hook consumes the typed GHC context', /\}\s*=\s*useGHC\(\)/.test(hook) && !/useGHC\(\)\s+as\s+any/.test(hook)],
  ['match IDs are derived from the declared match contract', /matches\.map\(\(match\)\s*=>\s*match\.userId\)/.test(hook)],
  ['permission actor uses the hydrated profile identity', /currentUserId:\s*profile\.id\s*,/.test(hook) && !/currentUserId:\s*["']current-user["']/.test(hook)],
  ['type-safety gate runs before TypeScript', pkg.scripts.pretypecheck.startsWith('node scripts/check-run288-type-safety.mjs &&')],
  ['permission identity behavior test runs before TypeScript', pkg.scripts.pretypecheck.includes('scripts/test-run288-permission-identity.mjs')],
  ['permission identity behavior test is part of static verification', pkg.scripts['verify:static'].includes('scripts/test-run288-permission-identity.mjs')],
  ['package and lockfile versions agree', pkg.version === '0.338.52' && JSON.parse(readFileSync('package-lock.json', 'utf8')).version === '0.338.52'],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`Run #288 type-safety contract: ${checks.length - failed}/${checks.length}`)
if (failed) process.exitCode = 1
