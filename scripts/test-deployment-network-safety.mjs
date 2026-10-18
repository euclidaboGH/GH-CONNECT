#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const envExample = read('.env.example')
const readiness = read('lib/server/readiness.ts')
const piEnv = read('lib/pi-env.ts')
const workflow = read('.github/workflows/ci.yml')
const deploy = read('VERCEL_DEPLOY.txt')
const { readdirSync } = fs
const referencedEnv = new Set()
function scanEnvRefs(dir) {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const full = path.join(root, dir, entry.name)
    if (entry.isDirectory()) scanEnvRefs(path.relative(root, full))
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
      const source = fs.readFileSync(full, 'utf8')
      for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) referencedEnv.add(match[1])
    }
  }
}
scanEnvRefs('app'); scanEnvRefs('lib'); scanEnvRefs('components')
for (const match of read('middleware.ts').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) referencedEnv.add(match[1])
const envNames = new Set([...envExample.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]))
const standardEnv = new Set(['NODE_ENV', 'VERCEL', 'VERCEL_ENV'])
const missingEnvDocs = [...referencedEnv].filter(name => !envNames.has(name) && !standardEnv.has(name))
const checks = [
  ['safe environment template exists', envExample.includes('NEXT_PUBLIC_PI_SANDBOX=true') && envExample.includes('SUPABASE_SERVICE_ROLE_KEY=')],
  ['all application environment references are documented', missingEnvDocs.length === 0 && missingEnvDocs.length === 0],
  ['template keeps Pi server credentials server-only', !/^NEXT_PUBLIC_(?:PI_API_KEY|PI_SERVER_API_KEY|SUPABASE_SERVICE_ROLE_KEY|PI_WALLET_PRIVATE_SEED)=/m.test(envExample)],
  ['template warns to split preview and production Supabase projects', /separate Supabase projects/.test(envExample)],
  ['mainnet readiness uses deployment target, not NODE_ENV alone', /isMainnetDeployment = vercelEnv === "production" \|\| process\.env\.GHC_ENV === "production"/.test(readiness)],
  ['preview deployments can legitimately use Testnet sandbox', /Vercel Preview is expected to use Pi Testnet/.test(readiness)],
  ['Pi network mode still explicitly checks sandbox/mainnet mismatch', /sandboxInProduction/.test(readiness) && /NEXT_PUBLIC_PI_SANDBOX/.test(readiness)],
  ['production host allowlist is explicit', /NEXT_PUBLIC_PI_PRODUCTION_HOSTS/.test(piEnv)],
  ['CI runs network safety test', /test:deployment-network-safety/.test(workflow)],
  ['deploy guide retains separate mainnet/testnet credential guidance', /NEXT_PUBLIC_PI_SANDBOX=false/.test(deploy) && /NEXT_PUBLIC_PI_SANDBOX=true/.test(deploy)],
]
let failed=0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
console.log(`\nDEPLOYMENT NETWORK SAFETY: ${checks.length-failed}/${checks.length}`)
if (failed) process.exit(1)
