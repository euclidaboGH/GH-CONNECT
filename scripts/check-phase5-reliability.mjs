import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const intelligence = read('lib/server/reputation/intelligence.ts')
const curation = read('app/api/social/posts/[id]/curation/route.ts')
const voteWeight = read('lib/server/ghpv/vote-weight.ts')
const checks = [
  ['release versions agree with current package version', Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.['']?.version === pkg.version],
  ['release metadata matches package', read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['intelligence RPC remains server-side and no-store', /Authorization:\s*`Bearer \$\{env\.supabaseServiceRoleKey\}`/.test(intelligence) && /cache:\s*"no-store"/.test(intelligence)],
  ['RPC error details are normalized to safe diagnostic codes', /function safeRpcError/.test(intelligence) && /SQLSTATE_/.test(intelligence) && /POSTGREST_SCHEMA_CACHE_STALE/.test(intelligence)],
  ['invalid/non-object RPC payloads fail closed', /RPC_RESPONSE_INVALID/.test(intelligence)],
  ['network failures are distinguished from schema failures', /RPC_NETWORK_FAILURE/.test(intelligence)],
  ['curation maps SQLSTATE and PostgREST schema failures to migration diagnostics', /SQLSTATE_\(\?:42883\|42P01\|42703\)/.test(curation) && /POSTGREST_SCHEMA_CACHE_STALE/.test(curation)],
  ['stored intelligence remains mandatory; no formula fallback', /if \(!intelligence\)\s*\{\s*throw new Error\("CURATION_INTELLIGENCE_UNAVAILABLE"\)/.test(voteWeight)],
  ['client-supplied curation authority remains stripped', /stripClientAuthority\(body\)/.test(curation)],
  ['no new database migration added for diagnostics', !fs.readdirSync(path.join(root, 'supabase/migrations')).some(n => /phase5.*diagnostic/i.test(n))],
  ['Phase 5 documentation exists', fs.existsSync(path.join(root, 'PHASE-5-CURATION-RELIABILITY.md'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`Phase 5 reliability checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
