#!/usr/bin/env node
/** Run #251: enforce server-only SECURITY DEFINER RPC access and future defaults. */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const read = (path) => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20261110160001_security_definer_rpc_server_only_acl_hardening.sql')
const pkg = JSON.parse(read('package.json'))
const checklist = read('docs/MIGRATION_CHECKLIST.md')
const roots = ['components', 'hooks', 'contexts', 'features']
const clientRpcFiles = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) walk(path)
    else if (/\.(?:ts|tsx|js|jsx)$/.test(name)) {
      const src = read(path)
      if (/\.rpc\s*\(|\/rest\/v1\/rpc\//.test(src)) clientRpcFiles.push(path)
    }
  }
}
for (const root of roots) walk(root)
const checks = [
  ['targets only public SECURITY DEFINER functions', /n\.nspname\s*=\s*'public'[\s\S]*?p\.prosecdef\s*=\s*true/.test(migration)],
  ['revokes PUBLIC, anon and authenticated EXECUTE without granting new service_role rights', /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/.test(migration) && !/GRANT EXECUTE/.test(migration)],
  ['preserves existing service_role ACLs', /Preserve each function's existing service_role ACL/.test(migration)],
  ['removes client EXECUTE from future postgres-owned public functions', /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public[\s\S]*?REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated/.test(migration)],
  ['does not accidentally re-enable the intentionally disabled generic reward staging RPC', !/GRANT EXECUTE ON FUNCTION public\.ghc_stage_pending/.test(migration)],
  ['no browser component, hook, context or feature invokes Supabase RPC directly', clientRpcFiles.length === 0],
  ['security gate is registered once in prebuild and static verification', ['prebuild:checks', 'verify:static'].every((key) => (pkg.scripts[key].match(/check-run251-security-definer-rpc-acl\.mjs/g) || []).length === 1)],
  ['migration is tracked in the generated review inventory', checklist.includes('20261110160001_security_definer_rpc_server_only_acl_hardening.sql')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${name.startsWith('no browser') && !ok ? ` (${clientRpcFiles.join(', ')})` : ''}`)
  if (!ok) failed++
}
console.log(`\nRun #251 SECURITY DEFINER ACL: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0)
