import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'))
const pkg = readJson('package.json')
const lock = readJson('package-lock.json')
const releasePath = join(root, 'lib/app-release.ts')
const release = readFileSync(releasePath, 'utf8')
const migrationsDir = join(root, 'supabase/migrations')
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
const checks = []
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail })

check('package and lockfile versions agree', pkg.version === lock.version && pkg.version === lock.packages?.['']?.version, `${pkg.version} / ${lock.version}`)
check('release notice uses package version', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`), `expected ${pkg.version}`)
check('Node engine supports documented runtime', /\^24\.15\.0/.test(pkg.engines?.node ?? ''), pkg.engines?.node ?? 'missing')
check('.nvmrc selects exact supported Node 24.15.0', readFileSync(join(root, '.nvmrc'), 'utf8').trim() === '24.15.0', readFileSync(join(root, '.nvmrc'), 'utf8').trim())
check('migration directory exists and has SQL', existsSync(migrationsDir) && migrations.length > 0, `${migrations.length} SQL files`)
const duplicateNames = migrations.filter((name, i) => i > 0 && migrations[i - 1] === name)
check('migration filenames are unique', duplicateNames.length === 0, duplicateNames.join(', '))
check('no local secret env files included in release tree', !readdirSync(root).some((name) => /^\.env(\.|$)/.test(name) && name !== '.env.example'), 'only .env.example is allowed in source tree')
check('CI workflow exists', existsSync(join(root, '.github/workflows/ci.yml')))
check('CI checks dependency-lock completeness before install', readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8').includes('node scripts/check-dependency-lock-integrity.mjs'))
const ciWorkflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
check('CI static and build jobs assert exact Node 24.15.0 runtime', (ciWorkflow.match(/process\.versions\.node !== '24\.15\.0'/g) || []).length === 2)
const vercelConfig = readJson('vercel.json')
check('Vercel install clears obsolete npm cache-dir environment aliases', /unset npm_config_cache_dir NPM_CONFIG_CACHE_DIR/.test(vercelConfig.installCommand ?? ''))
check('Vercel build clears oversized stale Webpack cache before compilation', /prepare-vercel-build\.mjs/.test(vercelConfig.buildCommand ?? '') && existsSync(join(root, 'scripts/prepare-vercel-build.mjs')))
check('native dependency install scripts are approved only at reviewed lockfile versions', pkg.allowScripts?.['sodium-native@3.4.1'] === true && pkg.allowScripts?.['unrs-resolver@1.12.2'] === true && Object.keys(pkg.allowScripts || {}).length === 2)
check('safe .env.example exists', existsSync(join(root, '.env.example')))
if (existsSync(join(root, '.env.example'))) {
  const envExample = readFileSync(join(root, '.env.example'), 'utf8')
  check('private credentials are not NEXT_PUBLIC in env template', !/^NEXT_PUBLIC_(?:PI_API_KEY|PI_SERVER_API_KEY|SUPABASE_SERVICE_ROLE_KEY|PI_WALLET_PRIVATE_SEED)=/m.test(envExample))
  const privateKeys = ['SUPABASE_SERVICE_ROLE_KEY', 'PI_SERVER_API_KEY', 'PI_WALLET_PRIVATE_SEED', 'PAYSTACK_SECRET_KEY', 'CRON_SECRET']
  const assignedPrivateValues = privateKeys.filter((key) => new RegExp(`^${key}[ \t]*=[ \t]*\\S+`, 'm').test(envExample))
  check('environment template contains no populated private credentials', assignedPrivateValues.length === 0, assignedPrivateValues.join(', '))
  check('environment template documents public and server-only configuration separately', envExample.includes('Public application URLs') && envExample.includes('Server-only Supabase configuration'))
}

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
console.log(`\nRelease hygiene: ${checks.filter(c => c.ok).length}/${checks.length} passed`)
if (checks.some(c => !c.ok)) process.exit(1)
