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
check('Node engine supports documented runtime', /\^22\.22\.2/.test(pkg.engines?.node ?? '') && /\^24\.15\.0/.test(pkg.engines?.node ?? ''), pkg.engines?.node ?? 'missing')
check('.nvmrc selects supported Node 24', readFileSync(join(root, '.nvmrc'), 'utf8').trim().startsWith('24'), readFileSync(join(root, '.nvmrc'), 'utf8').trim())
check('migration directory exists and has SQL', existsSync(migrationsDir) && migrations.length > 0, `${migrations.length} SQL files`)
const duplicateNames = migrations.filter((name, i) => i > 0 && migrations[i - 1] === name)
check('migration filenames are unique', duplicateNames.length === 0, duplicateNames.join(', '))
check('no local secret env files included in release tree', !readdirSync(root).some((name) => /^\.env(\.|$)/.test(name) && name !== '.env.example'), 'only .env.example is allowed in source tree')
check('CI workflow exists', existsSync(join(root, '.github/workflows/ci.yml')))
check('CI checks dependency-lock completeness before install', readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8').includes('node scripts/check-dependency-lock-integrity.mjs'))
check('safe .env.example exists', existsSync(join(root, '.env.example')))
if (existsSync(join(root, '.env.example'))) {
  const envExample = readFileSync(join(root, '.env.example'), 'utf8')
  check('private credentials are not NEXT_PUBLIC in env template', !/^NEXT_PUBLIC_(?:PI_API_KEY|PI_SERVER_API_KEY|SUPABASE_SERVICE_ROLE_KEY|PI_WALLET_PRIVATE_SEED)=/m.test(envExample))
}

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
console.log(`\nRelease hygiene: ${checks.filter(c => c.ok).length}/${checks.length} passed`)
if (checks.some(c => !c.ok)) process.exit(1)
