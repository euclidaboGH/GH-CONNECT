#!/usr/bin/env node
/** RUN375: keep the identity/session ACL hardening proposal isolated and non-executable. */
import { existsSync, readFileSync } from 'node:fs'
const proposalPath = 'supabase/proposals/20261119_revoke_client_select_identity_session_tables_review.sql'
const canonicalPath = 'supabase/migrations/20261119_revoke_client_select_identity_session_tables_review.sql'
const proposal = readFileSync(proposalPath, 'utf8')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const checks = [
  ['ACL hardening remains under proposals, not canonical migrations', existsSync(proposalPath) && !existsSync(canonicalPath)],
  ['proposal explicitly forbids direct live SQL Editor application', /Never paste this[\s\S]*?proposal directly into a live SQL Editor/.test(proposal)],
  ['only the two audited identity/session tables are targeted', /public\.gh_pi_identities[\s\S]*public\.gh_sessions/.test(proposal) && !/ghc_transactions|ghc_user_accounts|gh_wallet/i.test(proposal)],
  ['only SELECT is revoked from PUBLIC, anon and authenticated', /REVOKE SELECT ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated/.test(proposal)],
  ['proposal preserves RLS and service-role grants', /does not[\s\S]*alter RLS policies[\s\S]*service_role privileges/.test(proposal)],
  ['postflight asserts anon/authenticated SELECT is absent', /has_table_privilege\('anon',[\s\S]*has_table_privilege\('authenticated'/.test(proposal)],
  ['postflight asserts service_role SELECT remains available', /has_table_privilege\('service_role',[\s\S]*has_table_privilege\('service_role'/.test(proposal)],
  ['migration history reconciliation and operator approval remain mandatory', /migration history reconciliation[\s\S]*explicit operator approval/.test(proposal)],
  ['Mainnet review is separately gated', /Mainnet must be reviewed and approved separately/.test(proposal)],
  ['proposal is not added to the canonical migration inventory', !readFileSync('MIGRATION-SOURCE-MANIFEST.csv', 'utf8').includes('20261119_revoke_client_select_identity_session_tables_review.sql')],
  ['RUN375 gate is registered in all source verification entrypoints', ['prebuild:checks','verify:static','pretypecheck','prelint'].every(k => pkg.scripts?.[k]?.includes('check-run375-identity-session-acl-proposal.mjs'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nRUN375 identity/session ACL proposal: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
