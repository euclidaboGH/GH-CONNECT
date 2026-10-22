#!/usr/bin/env node
/**
 * Generates the repository-only migration inventory and manifest from the canonical
 * supabase/migrations directory. It never connects to or changes a database.
 * Use --check in CI to detect documentation drift without writing files.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationDir = join(root, 'supabase', 'migrations')
const checklistPath = join(root, 'docs', 'MIGRATION_CHECKLIST.md')
const manifestPath = join(root, 'VERIFIED_MANIFEST.txt')
const checkOnly = process.argv.includes('--check')
const listOnly = process.argv.includes('--list')
const diagnosticWrite = process.argv.includes('--write-diagnostic-inventory')

const proposals = new Set([
  '20261022010016_community_join_reasons_proposal.sql',
  '20261022010017_community_governance_log_proposal.sql',
])
const requiresApproval = new Set(['20261022010015_connection_request_intents.sql'])
const reviewRequired = new Set([
  '20261022010072_gh_curation_pipeline_atomic.sql',
  '20261022010073_reputation_event_integrity.sql',
  '20261022010074_curation_self_vote_guard.sql',
  '20261022010075_allow_self_curation.sql',
  '20261022010076_daily_claim_48h_lock.sql',
  '20261022010077_ghc_daily_claim_only_issuance.sql',
  '20261022010078_atomic_membership_purchase.sql',
  '20261022010079_atomic_marketplace_inventory_reservation.sql',
  '20261022010088_ghpv_soft_delete_quality_cleanup.sql',
  '20261022010090_ghpv_soft_delete_atomic.sql',
  '20261022010096_gh_social_notifications_types_extend.sql',
  '20261022010101_gh_content_rewards.sql',
  '20261022010102_gh_profile_content_library.sql',
  '20261022010103_gh_post_reaction_roster_visibility_guard.sql',
  '20261022010104_gh_story_creator_upgrade.sql',
  '20261022010105_gh_messaging_presence_delivery_receipts.sql',
  '20261022010106_gh_story_reactions.sql',
  '20261022010107_gh_post_created_notifications.sql',
  '20261022010101_gh_content_rewards.sql',
  '20261022010102_gh_profile_content_library.sql',
  '20261022010108_gh_system_announcements.sql',
  '20261022010109_gh_post_restore_owner_window.sql',
  '20261022010110_gh_lifecycle_payout_quality_foundation.sql',
  '20261022010087_gh_private_media_references_and_viewer_authz.sql',
  '20261022010111_gh_verified_tip_settlement_payout_reconciliation.sql',
  '20261022010112_ghc_tip_and_creator_reward_atomic_settlement.sql',
  '20261022010113_pi_a2u_sdk_execution_orchestration.sql',
  '20261022010114_ghc_atomic_seller_payout_settlement.sql',
  '20261022010115_paystack_ngn_beneficiaries_and_payouts.sql',
  '20261022010094_pi_payment_intent_idempotency_lookup.sql',
  '20261022010095_pi_payment_intent_atomic_transitions.sql',
  '20261022010097_gh_social_canonical_visibility.sql',
  '20261022010098_gh_social_engagement_write_integrity.sql',
])

const notes = {
  '20261022010015_connection_request_intents.sql': 'Product/security review; do not auto-apply.',
  '20261022010016_community_join_reasons_proposal.sql': 'Proposal only; do not apply without explicit approval.',
  '20261022010017_community_governance_log_proposal.sql': 'Proposal only; do not apply without explicit approval.',
  '20261022010027_gh_messaging_durable.sql': 'Durable messaging; flag remains off until two-user authorization gate passes.',
  '20261022010071_ghc_curation_rewards.sql': 'Curation credit is redistribution; Testnet-first and explicit Mainnet approval required.',
  '20261022010072_gh_curation_pipeline_atomic.sql': 'Review vote/reward/GHPV transaction ordering on disposable PostgreSQL and Testnet.',
  '20261022010073_reputation_event_integrity.sql': 'Review canonical event point values and migration dependencies.',
  '20261022010074_curation_self_vote_guard.sql': 'Review together with the later display-only self-curation policy migration.',
  '20261022010075_allow_self_curation.sql': 'Review with 004; self-curation must not count as independent evidence or earn rewards.',
  '20261022010076_daily_claim_48h_lock.sql': 'Validate boundary, idempotency and concurrent redemption on disposable PostgreSQL.',
  '20261022010077_ghc_daily_claim_only_issuance.sql': 'Issuance guard must later allow only the dedicated qualifying-referral path in addition to Daily Claim.',
  '20261022010078_atomic_membership_purchase.sql': 'Review schema/function signatures and atomic entitlement behaviour on disposable PostgreSQL.',
  '20261022010079_atomic_marketplace_inventory_reservation.sql': 'Validate row-lock concurrency, expiry/payment races, cancellation and recovery on disposable PostgreSQL.',
  '20261022010103_gh_post_reaction_roster_visibility_guard.sql': 'Review visibility and block checks; Testnet two-account validation required.',
  '20261022010104_gh_story_creator_upgrade.sql': 'Review audience visibility and matching fail-closed behaviour on Testnet.',
  '20261022010105_gh_messaging_presence_delivery_receipts.sql': 'Testnet-first; follow supabase/MESSAGING_PRESENCE_DEPLOY.md.',
  '20261022010106_gh_story_reactions.sql': 'Testnet-first; verify owner/block-protected toggle and visible counts.',
  '20261022010107_gh_post_created_notifications.sql': 'Review notification-type dependency and verify follower delivery on Testnet.',
  '20261022010101_gh_content_rewards.sql': 'Future-dated at the 2026-10-21 audit baseline; review dependencies, reward economics, authorization and target history before any application.',
  '20261022010102_gh_profile_content_library.sql': 'Future-dated at the 2026-10-21 audit baseline; review privacy/RLS, ownership and dependent API consumers before any application.',
  '20261022010109_gh_post_restore_owner_window.sql': 'Future-dated at the 2026-10-21 audit baseline; review deletion/restore policy, ownership and dependency order before any application.',
  '20261022010110_gh_lifecycle_payout_quality_foundation.sql': 'Future-dated at the 2026-10-21 audit baseline; payout/lifecycle controls require schema dependency review and disposable PostgreSQL validation before any application.',
  '20261022010108_gh_system_announcements.sql': 'Review announcement API ownership, RLS, and read-state behavior on Preview/Testnet before release.',
  '20261022010087_gh_private_media_references_and_viewer_authz.sql': 'Review function dependencies and test owner/public/follower/mutual/story/profile/message/marketplace/community access and blocked-user denial on two-user Testnet. Backfill is additive; do not flip bucket private until all consumers and legacy assets are reconciled.',
  '20261022010111_gh_verified_tip_settlement_payout_reconciliation.sql': 'Financially critical: validate on disposable PostgreSQL and Testnet. Confirm Pi provider status/recipient/amount/txid and retry idempotency. Records creator payables but does not disburse them; GHC tips remain disabled. Paid seller status now requires provider reconciliation.',
  '20261022010112_ghc_tip_and_creator_reward_atomic_settlement.sql': 'Financially critical: review ledger signatures and existing schema; canonical two-party transfer locks, precision/idempotency guards, atomic GHC tips and funded creator reward pool require disposable PostgreSQL and Testnet concurrency tests. GHC tip feature flag stays off until verification; reward pool requires explicit operator allowlist and funded ledger balance.',
  '20261022010113_pi_a2u_sdk_execution_orchestration.sql': 'Financially critical: review official pi-backend SDK integration against the exact Testnet schema. Test interrupted/retried A2U, unrelated incomplete payments, sequence lease expiry, duplicate requests and verified recipient/amount/txid on Testnet before enabling.',
  '20261022010114_ghc_atomic_seller_payout_settlement.sql': 'Financially critical: GHC seller payouts debit a configured funded treasury and credit the seller atomically. Review ledger schema/eligible-order rules and concurrency/idempotency on disposable PostgreSQL and Testnet. Keep disabled until treasury is funded and verified.',
  '20261022010115_paystack_ngn_beneficiaries_and_payouts.sql': 'Financially critical provider integration: validate Paystack Test Mode, signed webhook/reconciliation, duplicate/out-of-order events, RLS/grants, obligation reservation and concurrent requests on disposable PostgreSQL. This does not create NGN proceeds from GHC/PI; keep transfers disabled until an audited NGN revenue source exists.',
  '20261022010091_company_revenue_event_journal.sql': 'Financial accounting foundation: validate immutable journal permissions, provider-event/idempotency conflicts, refund direction, integer-minor-unit handling and service-role RPC execution on disposable PostgreSQL. Not integrated with payment flows and not deployment approval.',
  '20261022010094_pi_payment_intent_idempotency_lookup.sql': 'New payment-intent idempotency RPC; review service-role ACLs and unique-index behavior, apply only after target history reconciliation, and test duplicate/concurrent creation on disposable PostgreSQL before deploying the calling code.',
  '20261022010095_pi_payment_intent_atomic_transitions.sql': 'Financially critical row-lock RPCs for provider binding and payment status transitions. Review transition matrix, RLS/grants, unique provider/txid conflicts and concurrent approve/complete/recovery tests on disposable PostgreSQL and Testnet before deploying callers.',
  '20261022010097_gh_social_canonical_visibility.sql': 'Security-sensitive additive feed/comment RPCs; validate schema, grants, mutual-follow and community membership policy, stable cursors, and cross-account denial on disposable PostgreSQL and Testnet before applying.',
  '20261022010098_gh_social_engagement_write_integrity.sql': 'Security-sensitive durable vote/reaction/comment/save/share write-path repair. Review all RPC signatures and table columns, run disposable PostgreSQL concurrency/idempotency tests, reconcile counters, and validate two-account visibility/ownership on Testnet before applying.',
}

function classify(file) {
  if (proposals.has(file)) return 'PROPOSAL'
  if (requiresApproval.has(file)) return 'REQUIRES_APPROVAL'
  if (reviewRequired.has(file)) return 'REVIEW_REQUIRED'
  return 'REQUIRED'
}
function orderKey(file) {
  const date = (file.match(/^(\d{8})/) || [,'99999999'])[1]
  const digits = (file.match(/^(\d+)/) || [,''])[1]
  // For same-day migrations, order timestamped IDs before date-only IDs.
  return `${date}-${digits.length > 8 ? '0' : '1'}-${digits}-${file}`
}

const files = readdirSync(migrationDir)
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => orderKey(a).localeCompare(orderKey(b)))
if (!files.length) throw new Error(`No SQL migrations found in ${migrationDir}`)
const duplicates = files.filter((file, index) => index > 0 && file === files[index - 1])
if (duplicates.length) throw new Error(`Duplicate migration names: ${duplicates.join(', ')}`)
const versions = new Map()
for (const file of files) {
  const version = (file.match(/^(\d+)_/) || [,''])[1]
  if (!version) throw new Error(`Migration filename has no numeric version prefix: ${file}`)
  const group = versions.get(version) ?? []
  group.push(file)
  versions.set(version, group)
}
const duplicateVersions = [...versions.entries()].filter(([, group]) => group.length > 1)
if (duplicateVersions.length && !diagnosticWrite) throw new Error(`Duplicate Supabase migration version prefixes: ${duplicateVersions.map(([version, group]) => `${version} => ${group.join(', ')}`).join('; ')}`)
for (const file of [...proposals, ...requiresApproval, ...reviewRequired]) {
  if (!files.includes(file)) throw new Error(`Classified migration missing from disk: ${file}`)
}

const counts = Object.fromEntries(['REQUIRED', 'REQUIRES_APPROVAL', 'PROPOSAL', 'REVIEW_REQUIRED'].map((kind) => [kind, files.filter((file) => classify(file) === kind).length]))
const checklistRows = files.map((file, index) => `| ${index + 1} | \`${file}\` | ${classify(file)} | ${notes[file] ?? ''} |`).join('\n')
const blockerNote = duplicateVersions.length ? `\n\n**INVENTORY BLOCKED:** Duplicate Supabase migration version prefixes were found: ${duplicateVersions.map(([version, group]) => `\`${version}\` (${group.join(', ')})`).join('; ')}. This inventory is diagnostic only; do not apply migrations until these identifiers and remote history are reviewed.\n` : ''
const checklist = `# GreenHaven — Migration Checklist (generated source inventory)\n\n${blockerNote}\n**Generated by:** scripts/generate-migration-inventory.mjs (deterministic; no timestamp)\n**Canonical path:** \`supabase/migrations/*.sql\`\n**On-disk count:** **${files.length}**\n**Classification:** REQUIRED **${counts.REQUIRED}** · REQUIRES_APPROVAL **${counts.REQUIRES_APPROVAL}** · PROPOSAL **${counts.PROPOSAL}** · REVIEW_REQUIRED **${counts.REVIEW_REQUIRED}**\n\nThis is a repository inventory only. It does **not** prove that any migration is applied to Testnet or Mainnet.\n\n## Apply policy\n\n| Class | Action |\n|---|---|\n| **REQUIRED** | Candidate for operator review; reconcile target schema/history first, apply to disposable PostgreSQL/Testnet, verify, then seek explicit promotion approval. |\n| **REQUIRES_APPROVAL** | Product and security review, then explicit approval. |\n| **PROPOSAL** | **Do not apply** without written approval. |\n| **REVIEW_REQUIRED** | New, unreconciled, or sequencing-sensitive; inspect dependencies and validate on disposable PostgreSQL/Testnet before any application. |\n\n**Never bulk-apply this inventory.** Supabase CLI does not enforce these documentation classifications: any pending SQL file left in the canonical migration directory may be eligible for supabase db push. Do not run supabase db push until every pending file has been individually approved and target history reconciled. Filename order is not proof of migration history or safety. Reconcile Testnet and Mainnet independently, and preserve data.\n\n## Inventory\n\n| # | File | Class | Notes |\n|---:|---|---|---|\n${checklistRows}\n\n## Release-readiness notes\n\n- The current inventory contains **${files.length}** migration files. Counts and row order are generated from the canonical directory.\n- Migrations with newer sequence identifiers are not automatically invalid, but their dependencies, approval status, and target-project history must be reviewed before execution.\n- The self-curation policy includes both a guard migration and a later allowance migration. Confirm the final function definition on a disposable clean database and Testnet; self-curation must not count as independent evidence or earn rewards.\n- The marketplace reservation migration remains unverified against PostgreSQL. Do not enable finite-stock production sales until concurrency, payment races, expiry, cancellation, and recovery pass.\n- This checklist is not a deployment approval and is not a record of applied migrations.\n`

const manifest = `GH-CONNECT VERIFIED SOURCE MANIFEST\n==================================\ninventory_status=${duplicateVersions.length ? 'BLOCKED_DUPLICATE_VERSION_PREFIXES' : 'OK'}\nduplicate_version_prefixes=${duplicateVersions.map(([version]) => version).join(',')}\nproject_version=${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version}\nmanifest_format_version=1\ncanonical_migrations=${files.length}\nclassification_required=${counts.REQUIRED}\nclassification_requires_approval=${counts.REQUIRES_APPROVAL}\nclassification_proposal=${counts.PROPOSAL}\nclassification_review_required=${counts.REVIEW_REQUIRED}\nsource=supabase/migrations/*.sql\n\nIMPORTANT: This manifest inventories repository files only. It does NOT prove migrations are applied to any Supabase project.\n\nCLASSIFICATION_POLICY:\n  REQUIRED            = candidate for operator review; reconcile target schema/history before applying\n  REQUIRES_APPROVAL   = product/security review before apply\n  PROPOSAL            = do NOT apply without explicit written approval\n  REVIEW_REQUIRED     = unreconciled or sequencing-sensitive; validate on disposable PostgreSQL/Testnet first\n\nAPPLICATION_GUARD: Supabase CLI does not enforce this classification metadata. Do not run db push while any pending migration is unreviewed, a proposal, or awaiting approval.\n\nALL_MIGRATIONS_ORDERED_FOR_REVIEW:\n${files.map((file) => `[${classify(file)}] size=${statSync(join(migrationDir, file)).size} path=supabase/migrations/${file}`).join('\n')}\n`

const outputs = [[checklistPath, checklist], [manifestPath, manifest]]
let drift = false
for (const [path, content] of outputs) {
  let existing = ''
  try { existing = readFileSync(path, 'utf8') } catch {}
  if (existing === content) {
    console.log(`PASS ${path.slice(root.length + 1)} is synchronized`)
  } else if (checkOnly) {
    console.error(`DRIFT ${path.slice(root.length + 1)} differs from canonical migration inventory`)
    drift = true
  } else if (listOnly) {
    // Read-only listing mode; never rewrites files.
  } else {
    writeFileSync(path, content, 'utf8')
    console.log(`UPDATED ${path.slice(root.length + 1)}`)
  }
}
if (diagnosticWrite && duplicateVersions.length) {
  console.error(`BLOCKED inventory written for diagnosis only; duplicate migration versions: ${duplicateVersions.map(([version]) => version).join(', ')}`)
}
if (listOnly) {
  console.log('\nPer-file classification:')
  for (const file of files) console.log(`  [${classify(file).padEnd(17)}] ${file}`)
}
if (drift) process.exit(1)
console.log(`\nMigration inventory: ${files.length} files — ${JSON.stringify(counts)}`)
