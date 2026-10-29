#!/usr/bin/env node
/** Static-only RLS coverage audit over canonical migration source. Never connects to a database. */
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'supabase', 'migrations')
const files = (await readdir(dir)).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort()

function stripSqlComments(sql) {
  let out = '', i = 0, mode = 'normal'
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1]
    if (mode === 'normal') {
      if (c === '-' && n === '-') { mode = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && n === '*') { mode = 'block'; out += '  '; i += 2; continue }
      if (c === "'") { mode = 'single'; out += c; i++; continue }
      if (c === '"') { mode = 'double'; out += c; i++; continue }
      out += c; i++; continue
    }
    if (mode === 'line') { if (c === '\n') { mode = 'normal'; out += '\n' } else out += ' '; i++; continue }
    if (mode === 'block') { if (c === '*' && n === '/') { mode = 'normal'; out += '  '; i += 2 } else { out += c === '\n' ? '\n' : ' '; i++ } continue }
    if (mode === 'single') { out += c; if (c === "'" && n === "'") { out += n; i += 2; continue } if (c === "'") mode = 'normal'; i++; continue }
    if (mode === 'double') { out += c; if (c === '"' && n === '"') { out += n; i += 2; continue } if (c === '"') mode = 'normal'; i++; continue }
  }
  return out
}

const created = new Set(), enabled = new Set(), policyTables = new Set()
for (const file of files) {
  const sql = stripSqlComments(await readFile(join(dir, file), 'utf8'))
  for (const m of sql.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][\w$]*)/gi)) created.add(m[1].toLowerCase())
  for (const m of sql.matchAll(/\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][\w$]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/gi)) enabled.add(m[1].toLowerCase())
  for (const m of sql.matchAll(/\bCREATE\s+POLICY\s+[\w"]+\s+ON\s+(?:public\.)?([a-z_][\w$]*)/gi)) policyTables.add(m[1].toLowerCase())
}

// Explicitly service-managed tables must not be silently assumed to need client policies.
// Any newly created table without a policy must be reviewed and added here only with a reason.
const serviceManagedWithoutClientPolicy = new Set([
  'gh_company_revenue_events', 'gh_security_events', 'gh_security_rate_limit_buckets',
  'gh_verification_requests', 'ghc_account_flags', 'ghc_community_moderation_log',
  'ghc_community_reports', 'ghc_connection_contexts', 'ghc_connection_requests',
  'ghc_match_signals', 'ghc_user_blocks',
  'gh_pi_cashback_periods', 'gh_pi_cashback_entitlements',
])
const missingRls = [...created].filter((table) => !enabled.has(table)).sort()
const unreviewedNoPolicy = [...created].filter((table) => !policyTables.has(table) && !serviceManagedWithoutClientPolicy.has(table)).sort()
const staleAllowlist = [...serviceManagedWithoutClientPolicy].filter((table) => !created.has(table) || policyTables.has(table)).sort()
const failures = []
if (!files.length) failures.push('No timestamped canonical migration files were found.')
if (missingRls.length) failures.push(`Tables without explicit ENABLE ROW LEVEL SECURITY: ${missingRls.join(', ')}`)
if (unreviewedNoPolicy.length) failures.push(`Tables without policies and without explicit service-managed review: ${unreviewedNoPolicy.join(', ')}`)
if (staleAllowlist.length) failures.push(`Service-managed no-policy allowlist needs review: ${staleAllowlist.join(', ')}`)
if (failures.length) { console.error(failures.map((failure) => `FAIL ${failure}`).join('\n')); process.exit(1) }
console.log(`PASS static RLS coverage: ${created.size} executable table names have explicit RLS enablement.`)
console.log(`PASS policy review: ${policyTables.size} tables have policy definitions; ${serviceManagedWithoutClientPolicy.size} no-policy tables are explicitly allowlisted for operator/service-role review.`)
console.log('LIMIT: source inspection does not prove deployed RLS state, grants, policy correctness, or service-role isolation. Verify each target database independently.')
