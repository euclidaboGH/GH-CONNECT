#!/usr/bin/env node
/** Run #269: guard server-only public-table writes and the Testnet ACL migration. */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const pkg = JSON.parse(read('package.json'))
const migrationPath = 'supabase/migrations/20261110174922_revoke_client_table_write_and_sequence_privileges.sql'
const migration = read(migrationPath)
const prebuild = pkg.scripts?.['prebuild:checks'] ?? ''
const verify = pkg.scripts?.['verify:static'] ?? ''
const checks = []
const add = (name, ok) => {
  checks.push(Boolean(ok))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}
const countScript = (command, script) => command.split('&&').filter((part) => part.trim() === `node ${script}`).length
const walk = (dir) => {
  let out = []
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out = out.concat(walk(path))
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) out.push(path)
  }
  return out
}

add('migration has the exact 14-digit version recorded on Testnet', migrationPath.includes('20261110174922_') && migration.includes('20261110174922'))
add('migration revokes client INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on all public tables', /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE,\s*TRUNCATE,\s*REFERENCES,\s*TRIGGER\s+ON ALL TABLES IN SCHEMA public\s+FROM anon, authenticated/i.test(migration))
add('migration revokes client USAGE/SELECT/UPDATE on all public sequences', /REVOKE\s+USAGE,\s*SELECT,\s*UPDATE\s+ON ALL SEQUENCES IN SCHEMA public\s+FROM anon, authenticated/i.test(migration))
add('postgres default table privileges fail closed for future tables', /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL ON TABLES FROM anon, authenticated/i.test(migration))
add('postgres default sequence privileges fail closed for future sequences', /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL ON SEQUENCES FROM anon, authenticated/i.test(migration))
add('existing public SELECT grants are preserved', !/REVOKE\s+(?:ALL|SELECT)[\s\S]{0,100}ON ALL TABLES IN SCHEMA public/i.test(migration))
add('migration contains no row, ledger, payment, payout or storage mutation', !/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i.test(migration))
add('migration explicitly preserves server-side service-role access', /service_role access is preserved/i.test(migration) && !/FROM\s+[^;]*service_role/i.test(migration))
add('ACL regression check is registered once in prebuild', countScript(prebuild, 'scripts/check-run269-client-table-write-acl.mjs') === 1)
add('ACL regression check is registered once in static verification', countScript(verify, 'scripts/check-run269-client-table-write-acl.mjs') === 1)
add('visual-cohesion prebuild check is also in static verification', countScript(prebuild, 'scripts/check-phase2-visual-cohesion.mjs') === 1 && countScript(verify, 'scripts/check-phase2-visual-cohesion.mjs') === 1)
add('social-loop prebuild check is also in static verification', countScript(prebuild, 'scripts/check-pass16-social-loop.mjs') === 1 && countScript(verify, 'scripts/check-pass16-social-loop.mjs') === 1)

const browserDirs = ['components', 'contexts', 'hooks', 'app']
const browserFiles = browserDirs.flatMap((dir) => walk(dir)).filter((path) => !path.startsWith('app/api/'))
const browserSources = browserFiles.map((path) => [path, read(path)])
const forbidden = [
  ['Supabase browser SDK import', /from\s+["']@supabase\/(?:supabase-js|ssr)["']/],
  ['Supabase browser client constructor', /\bcreateBrowserClient\s*\(/],
  ['direct Supabase table client write', /\bsupabase\s*\.\s*from\s*\(/],
  ['public Supabase credentials in browser code', /NEXT_PUBLIC_SUPABASE_(?:URL|ANON_KEY|PUBLISHABLE_KEY)/],
  ['direct browser PostgREST call', /\/rest\/v1\//],
]
for (const [label, pattern] of forbidden) {
  const hits = browserSources.filter(([, source]) => pattern.test(source)).map(([path]) => relative(root, path))
  add(`browser surfaces contain no ${label.toLowerCase()}`, hits.length === 0)
  if (hits.length) console.log(`  found: ${hits.slice(0, 5).join(', ')}`)
}

add('source-of-truth documents the package release', new RegExp('^\\*\\*Current source version:\\*\\* `' + pkg.version.replaceAll('.', '\\.') + '`$', 'm').test(read('docs/SOURCE_OF_TRUTH.md')))
add('current migration inventory contains the applied ACL migration', read('docs/MIGRATION_CHECKLIST.md').includes('20261110174922_revoke_client_table_write_and_sequence_privileges.sql'))
add('Testnet reconciliation records the verified postflight and Mainnet hold', /20261110174922/.test(read('docs/TESTNET-RECONCILIATION-2026-11-10.md')) && /Mainnet remains inactive/.test(read('docs/TESTNET-RECONCILIATION-2026-11-10.md')))

const passed = checks.filter(Boolean).length
console.log(`\nRun #269 client-table/sequence ACL contract: ${passed}/${checks.length} passed`)
if (passed !== checks.length) process.exit(1)
