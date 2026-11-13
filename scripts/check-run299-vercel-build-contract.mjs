#!/usr/bin/env node
/** Run #299: regression guards for the reported Vercel TypeScript/lint failure and build hygiene. */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const read = (path) => readFileSync(path, 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const context = read('contexts/ghc-context.tsx')
const profile = read('components/ghc/profile-screen.tsx')
const logger = read('lib/client/debug-log.ts')
const release = read('lib/app-release.ts')
const vercel = JSON.parse(read('vercel.json'))
const ignore = read('.vercelignore').split(/\r?\n/).map((line) => line.trim())
const prep = read('scripts/prepare-vercel-build.mjs')
const truth = read('docs/PROJECT_TRUTH.md')
const checks = [
  ['Profile consumes canonical typed profile hook', /const ghc = useGHCProfile\(\)/.test(profile)],
  ['Profile has no contradictory updateProfile Promise<void> contract', !/updateProfile\??:\s*\(updates:\s*Partial<Profile>\)\s*=>\s*Promise<void>/.test(profile)],
  ['Profile has no unsafe unknown cast around the context hook', !/useGHCProfile\(\)\s+as\s+unknown/.test(profile)],
  ['Canonical context updateProfile result is boolean', /updateProfile:\s*\(updates:\s*Partial<Profile>\)\s*=>\s*Promise<boolean>/.test(context)],
  ['Canonical context exposes friends and following', /friends:\s*string\[\]/.test(context) && /following:\s*string\[\]/.test(context)],
  ['Canonical context exposes addToast', /addToast:\s*\(message:\s*string,\s*type:\s*"success"\s*\|\s*"error"\s*\|\s*"info"\)\s*=>\s*void/.test(context)],
  ['Development debug logger is gated by NODE_ENV', /process\.env\.NODE_ENV !== "production"/.test(logger)],
  ['Debug logger does not retain stale no-console suppression', !/eslint-disable-next-line no-console/.test(logger)],
  ['Debug logger still protects calls from throwing', (logger.match(/catch \{/g) || []).length >= 3],
  ['Package and lockfile root versions match', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version],
  ['Package and lockfile Node engine is pinned to Node 24.15+', pkg.engines?.node === '^24.15.0' && read('.nvmrc').trim() === '24.15.0'],
  ['Vercel install uses deterministic npm ci', /npm ci/.test(vercel.installCommand || '')],
  ['Vercel install clears unsupported npm cache-dir config', /unset npm_config_cache_dir NPM_CONFIG_CACHE_DIR/.test(vercel.installCommand || '')],
  ['Vercel build invokes guarded cache preparation', /scripts\/prepare-vercel-build\.mjs/.test(vercel.buildCommand || '')],
  ['Vercel build clears unsupported npm cache-dir config', /unset npm_config_cache_dir NPM_CONFIG_CACHE_DIR/.test(vercel.buildCommand || '')],
  ['Vercel upload excludes dependency trees', ignore.includes('node_modules') && ignore.includes('node_modules/**')],
  ['Vercel upload excludes generated build/cache trees', ['.next', '.next/**', '.cache', '.cache/**', '.turbo', '.turbo/**'].every((item) => ignore.includes(item))],
  ['Vercel upload excludes archives and local env files', ignore.includes('*.zip') && ignore.includes('.env*') && ignore.includes('!.env.example')],
  ['Build cache cleanup rejects paths outside project root and symlinks', prep.includes('target.startsWith(`${root}${sep}`)') && prep.includes('isSymbolicLink()')],
  ['Release gate remains explicitly not approved', truth.includes('Production status:** NOT APPROVED') || truth.includes('Production remains **NOT APPROVED**')],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed += 1
}
const migrationCount = readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql')).length
if (!Number.isInteger(migrationCount) || migrationCount < 1) failed += 1
console.log(`Run #299 build-contract regression: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
