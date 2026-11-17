#!/usr/bin/env node
/** Static-only RLS coverage audit over canonical migration source. Never connects to a database. */
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'supabase', 'migrations')
const files = (await readdir(dir)).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort()
// Held proposals are scanned too: they must meet the same RLS bar before anyone promotes them.
const proposalDir = join(root, 'supabase', 'proposals')
const proposalFiles = (await readdir(proposalDir).catch(() => [])).filter((name) => /\.sql$/.test(name)).sort()
const sourcePaths = [...files.map((f) => join(dir, f)), ...proposalFiles.map((f) => join(proposalDir, f))]

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
// Explicitly service-managed tables must not be silently assumed to need client policies.
// Any newly created table without a policy must be reviewed and added here only with a reason.
const serviceManagedWithoutClientPolicy = new Set([
  'gh_company_revenue_events', 'gh_security_events', 'gh_security_rate_limit_buckets',
  'gh_verification_requests', 'ghc_account_flags', 'ghc_community_moderation_log',
  'ghc_community_reports', 'ghc_connection_contexts', 'ghc_connection_requests',
  'ghc_match_signals', 'ghc_user_blocks',
  'gh_pi_cashback_periods', 'gh_pi_cashback_entitlements',
  // New Research/Field/Evidence tables are intentionally service-mediated.
  'gh_research_projects', 'gh_research_responses', 'gh_research_members', 'gh_research_evidence',
  'gh_research_geo_levels', 'gh_research_geo_units', 'gh_research_election_contests',
  'gh_research_candidates', 'gh_research_agent_assignments', 'gh_research_tallies',
  'gh_research_tally_candidate_votes', 'gh_research_exam_attempts', 'gh_research_challenges',
  'gh_research_challenge_participants', 'gh_research_challenge_events', 'gh_social_poll_settings',
  'gh_social_challenges', 'gh_social_challenge_participants', 'gh_social_challenge_events',
  'gh_research_audit_events', 'gh_field_reports', 'gh_field_report_evidence',
  'gh_scoped_evidence_uploads', 'gh_evidence_chain_events',
])

for (const path of sourcePaths) {
  const sql = stripSqlComments(await readFile(path, 'utf8'))
  for (const m of sql.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][\w$]*)/gi)) created.add(m[1].toLowerCase())
  for (const m of sql.matchAll(/\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_][\w$]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/gi)) enabled.add(m[1].toLowerCase())
  for (const m of sql.matchAll(/\bCREATE\s+POLICY\s+[\w"]+\s+ON\s+(?:public\.)?([a-z_][\w$]*)/gi)) policyTables.add(m[1].toLowerCase())

  // Understand explicit service-only migrations that apply RLS to a declared
  // table array in one reviewed DO/FOREACH block. Do not infer coverage from
  // arbitrary dynamic SQL: require ENABLE RLS, client-role revocation and a
  // service_role grant in the same loop body.
  for (const loop of sql.matchAll(/\bFOREACH\s+([a-z_][\w$]*)\s+IN\s+ARRAY\s+ARRAY\[([\s\S]*?)\]\s+LOOP([\s\S]*?)END\s+LOOP/gi)) {
    const tableNames = [...loop[2].matchAll(/'([a-z_][\w$]*)'/gi)].map((m) => m[1].toLowerCase())
    const body = loop[3]
    const enablesRls = /ALTER\s+TABLE\s+public\.%I\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(body)
    const revokesClientRoles = /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.%I\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i.test(body)
    const grantsServiceRole = /GRANT\s+[A-Z ,]+\s+ON\s+TABLE\s+public\.%I\s+TO\s+service_role/i.test(body)
    if (tableNames.length && enablesRls && revokesClientRoles && grantsServiceRole) {
      for (const table of tableNames) {
        enabled.add(table)
        serviceManagedWithoutClientPolicy.add(table)
      }
    }
  }
}

const missingRls = [...created].filter((table) => !enabled.has(table)).sort()
const unreviewedNoPolicy = [...created].filter((table) => !policyTables.has(table) && !serviceManagedWithoutClientPolicy.has(table)).sort()
const staleAllowlist = [...serviceManagedWithoutClientPolicy].filter((table) => !created.has(table) || policyTables.has(table)).sort()
const failures = []
if (!files.length) failures.push('No timestamped canonical migration files were found.')
if (missingRls.length) failures.push(`Tables without explicit ENABLE ROW LEVEL SECURITY: ${missingRls.join(', ')}`)
if (unreviewedNoPolicy.length) failures.push(`Tables without policies and without explicit service-managed review: ${unreviewedNoPolicy.join(', ')}`)
if (staleAllowlist.length) failures.push(`Service-managed no-policy allowlist needs review: ${staleAllowlist.join(', ')}`)
if (failures.length) { console.error(failures.map((failure) => `FAIL ${failure}`).join('\n')); process.exit(1) }
console.log(`PASS static RLS coverage: ${created.size} executable table names have explicit RLS enablement (migrations + ${proposalFiles.length} held proposals).`)
console.log(`PASS policy review: ${policyTables.size} tables have policy definitions; ${serviceManagedWithoutClientPolicy.size} no-policy tables are explicitly allowlisted for operator/service-role review.`)
console.log('LIMIT: source inspection does not prove deployed RLS state, grants, policy correctness, or service-role isolation. Verify each target database independently.')
