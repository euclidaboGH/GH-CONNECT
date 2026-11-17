#!/usr/bin/env node
/** Static migration chronology guard. Never connects to or mutates a database. */
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'supabase', 'migrations')
const auditDate = process.env.GHC_MIGRATION_AUDIT_DATE || new Date().toISOString().slice(0, 10).replaceAll('-', '')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => {
  const av = (a.match(/^(\d+)_/) || [,''])[1]
  const bv = (b.match(/^(\d+)_/) || [,''])[1]
  return av.localeCompare(bv) || a.localeCompare(b)
})
const future = files.filter((f) => {
  const stamp = (f.match(/^(\d{8})/) || [,''])[1]
  return stamp && stamp > auditDate
})
const guard = '20261022010074_curation_self_vote_guard.sql'
const allow = '20261022010075_allow_self_curation.sql'
const finalPolicy = '20261106110001_phase1_curation_community_guard_reconciliation.sql'
const indexGuard = files.indexOf(guard)
const indexAllow = files.indexOf(allow)
const indexFinalPolicy = files.indexOf(finalPolicy)
const finalPolicySql = files.includes(finalPolicy) ? readFileSync(join(dir, finalPolicy), 'utf8') : ''
const failures = []

// Supabase identifies a migration by the numeric prefix before the first underscore,
// not by the full filename. Duplicate prefixes must block readiness: renaming a file
// before reconciling remote Testnet/Mainnet history could make an applied migration
// appear new or create a local/remote history mismatch.
const versions = new Map()
for (const file of files) {
  const version = (file.match(/^(\d+)_/) || [,''])[1]
  if (!version) {
    failures.push(`Migration filename has no numeric version prefix: ${file}`)
    continue
  }
  const sameVersion = versions.get(version) ?? []
  sameVersion.push(file)
  versions.set(version, sameVersion)
}
for (const [version, sameVersion] of versions) {
  if (sameVersion.length > 1) {
    failures.push(`Duplicate Supabase migration version ${version}: ${sameVersion.join(', ')}. Reconcile Testnet and Mainnet histories before renaming or moving either file.`)
  }
}
if (indexGuard < 0 || indexAllow < 0 || indexGuard >= indexAllow) failures.push('Historical self-curation guard/allowance migrations are missing or out of order.')
if (indexFinalPolicy < 0 || indexFinalPolicy <= indexAllow) failures.push('Final Phase 1 curation policy migration must follow the historical self-curation allowance.')
if (!/v_post\.author_id\s*=\s*v_user[\s\S]*?SELF_CURATION_FORBIDDEN/.test(finalPolicySql)) failures.push('Final Phase 1 policy must consistently reject self-curation in preflight.')
if (!/gh_post_viewer_can_read\(v_user,\s*v_post_id\)/.test(finalPolicySql)) failures.push('Final Phase 1 policy must delegate access to canonical viewer visibility.')
if (!/gh_curate_daily:[\s\S]*?gh_curation_preflight/.test(finalPolicySql)) failures.push('Final Phase 1 policy must serialize the per-user daily quota before preflight.')
for (const f of [guard, allow, finalPolicy]) {
  if (!files.includes(f)) failures.push(`Required migration missing: ${f}`)
}
console.log(`Migration release-readiness (static only; no database access)\nFiles found: ${files.length}\nAudit date: ${auditDate}\n`)
if (failures.length) {
  for (const f of failures) console.error(`BLOCK: ${f}`)
} else {
  console.log(`PASS: historical self-curation policy conflict is superseded by the final Phase 1 policy (${guard} -> ${allow} -> ${finalPolicy}).`)
}
if (future.length) {
  console.warn(`\nREVIEW REQUIRED: ${future.length} migration(s) have filename dates after the audit date. Do not apply them until dependencies and target migration history are reviewed:`)
  for (const f of future) console.warn(`  - ${f}`)
} else console.log('PASS: no future-dated migration filenames detected.')
console.log('\nIMPORTANT: lexical/file order is not proof of applied status. Reconcile `supabase migration list` / the target project migration history independently for Testnet and Mainnet.')
if (failures.length) process.exit(1)
