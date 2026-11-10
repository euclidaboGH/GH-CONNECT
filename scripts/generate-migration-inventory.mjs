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
  '20261107120001_withdrawal_pin_recovery_questions.sql',
  '20261107130001_wallet_security_hardening.sql',
  '20261106170001_phase8_verified_mission_achievements.sql',
  '20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql',
  '20261106143001_phase9_membership_pi_renewal_strict_provider_guard.sql',
  '20261107160001_membership_active_tier_downgrade_guard.sql',
  '20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql',
  '20261107180001_marketplace_sku_variants_atomic_inventory.sql',
  '20261107190001_marketplace_fulfilment_tracking_timeline.sql',
  '20261108120001_gh_community_server_filter_search.sql',
  '20261108150001_repair_pin_storage_and_payout_release.sql',
  '20261109100001_gh_messaging_phase1_controls_search.sql',
  '20261110100001_withdrawal_rpc_acl_and_recovery_atomicity.sql',
  '20261110110001_wallet_recovery_reset_lock_race_guard.sql',
  '20261110160001_security_definer_rpc_server_only_acl_hardening.sql',
  '20261110170001_function_search_path_hardening.sql',
  '20261110180001_remove_verified_duplicate_indexes.sql',
  '20261110190001_rls_policy_dedup_and_initplan_optimization.sql',
  '20261110200001_supporting_foreign_key_indexes.sql',
  '20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics.sql',
  '20261110210001_pi_a2u_ecosystem_qualification.sql',
  '20261027010002_gh_media_asset_create_immutable_identity.sql',
  '20261027010003_gh_media_upload_finalize_identity.sql',
  '20261027010004_ghc_transfer_request_idempotency_intent.sql',
  '20261027010005_ghc_transfer_request_rpc_acl_hardening.sql',
  '20261030010006_pi_earnings_receipt_and_lease_fencing.sql',
  '20261030010007_pi_a2u_shared_sequence_lane.sql',
  '20261030010008_phase7_treasury_reporting_and_case_history.sql',
  '20261030010009_phase20_marketplace_net_proceeds.sql',
  '20261030010010_phase21_marketplace_case_event_journal.sql',
  '20261030010011_phase22_marketplace_adjustments_and_payout_fencing.sql',
  '20261030010012_phase23_treasury_community_reconciliation.sql',
  '20261030010013_phase24_financial_exception_detail.sql',
  '20261030010014_phase25_operational_financial_workflows.sql',
  '20261022010072_gh_curation_pipeline_atomic.sql',
  '20261022010073_reputation_event_integrity.sql',
  '20261022010074_curation_self_vote_guard.sql',
  '20261022010075_allow_self_curation.sql',
  '20261106080001_gh_reputation_intelligence_refresh_recovery.sql',
  '20261106090001_gh_community_post_feed_canonical.sql',
  '20261106110001_phase1_curation_community_guard_reconciliation.sql',
  '20261106130001_gh_story_view_privacy_and_read_performance.sql',
  '20261106150001_marketplace_listing_report_intake.sql',
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
  '20261025010001_gh_community_create_idempotency_guard.sql',
  '20261025090001_backfill_daily_claim_48h_metadata.sql',
  '20261028010001_ghc_canonical_identity_state_and_race_hardening.sql',
  '20261028160000_marketplace_buyer_confirmation_delivery_gate.sql',
  '20261029010001_pi_cashback_attribution_and_period_ledger.sql',
  '20261029010002_pi_cashback_user_statement_rpc.sql',
  '20261029010003_pi_cashback_period_reconciliation_grace.sql',
  '20261029010004_pi_cashback_testnet_a2u_payouts.sql',
  '20261030010001_registration_bonus_v2_reconciliation.sql',
  '20261030010002_pi_earnings_payout_requests.sql',
  '20261030010003_pi_earnings_payout_settlement_recovery.sql',
  '20261031010002_gh_community_chat_review_membership_order.sql',
  '20261101010001_gh_security_control_plane_retention.sql',
  '20261104170001_marketplace_order_read_cleanup_separation.sql',
  '20261104180001_gh_community_list_memberships_viewer.sql',
  '20261105160001_pi_wallet_authorization_explicit_consent_only.sql',
  '20261105170001_phase3_earnings_ledger_integrity_hardening.sql',
])

const notes = {
  '20261110110002_marketplace_orders_list_rpc_alias_fix.sql': 'Run #258: Testnet-only read-path repair for the confirmed 42703 alias defect in gh_marketplace_orders_list_for_user. Replaces the projection with the existing order getter, orders by the real created_at column, caps output at 200, pins search_path, and preserves service_role-only execution. No order, stock, payment, or ledger rows are changed.',
  '20261110190001_rls_policy_dedup_and_initplan_optimization.sql': 'Run #254 applied idempotently on Testnet under generated history versions 20261110093142 and 20261110093227 (the policy cleanup was submitted twice; both records are retained). Removed eight provably redundant false/identical permissive policies while retaining the specific SELECT policies and RLS deny-write behavior; wrapped auth.uid() in SELECT for all seven flagged policies. Postflight: 0 multiple-permissive-policy and 0 auth_rls_initplan findings.',
  '20261110200001_supporting_foreign_key_indexes.sql': 'Run #255 applied on Testnet under generated history version 20261110093228. Added all eleven advisor-confirmed FK-supporting indexes; postflight unindexed_foreign_keys count is zero. The indexes may appear unused on low-traffic Testnet; do not remove them without workload evidence.',
  '20261110200001_supporting_foreign_key_indexes.sql': 'Run #255: add eleven advisor-confirmed missing FK-supporting btree indexes. No rows or constraints are modified; postflight must confirm unindexed_foreign_keys count reaches zero. Do not use this as a reason to drop unused indexes.',
  '20261110190001_rls_policy_dedup_and_initplan_optimization.sql': 'Run #254 safe RLS/performance cleanup. Removes only duplicate permissive policies whose predicates are false or identical; no write policy is introduced, and RLS remains enabled. Wraps auth.uid() in scalar SELECTs for the seven advisor-flagged policies. Validate postflight: 0 multiple-permissive-policy and 0 auth_rls_initplan findings, with public SELECT and client write-deny semantics unchanged.',
  '20261110180001_remove_verified_duplicate_indexes.sql': 'Run #253 applied idempotently on Testnet under generated history versions 20261110092347 and 20261110092407 (the cleanup command was submitted twice; both records are retained and must not be manually deleted). Drops uq_ghc_earned_user_ref because it is identical to uq_ghc_earned_posted_ref; drops idx_gh_community_reports_status_created because it is identical to idx_gh_community_reports_queue. Catalog confirmed neither dropped index backs a constraint. Earlier source migrations were corrected to avoid recreating duplicates.',
  '20261110170001_function_search_path_hardening.sql': 'Run #252 applied on Testnet under generated history version 20261110092226. Both functions were inspected: ghc_available_balance fully qualifies public.ghc_transactions; gh_reputation_level_from_points uses only built-ins. Both now have search_path=pg_catalog; the two mutable-search-path security warnings are cleared. CLI history reconciliation remains required.',
  '20261110160001_security_definer_rpc_server_only_acl_hardening.sql': 'Run #251 security hardening applied and verified on Testnet under generated history version 20261110092119. Preflight found 112 of 290 public SECURITY DEFINER functions executable by anon/authenticated, including wallet, transfer, withdrawal, marketplace and community mutations. Postflight confirms 0/290 client-executable, 286/290 remain service_role-executable, and the four internal/legacy/disabled functions retain their previous non-service_role state. The postgres-owned public-schema default now grants EXECUTE only to postgres/service_role. Supabase CLI was unavailable; source file uses the repository timestamp naming convention and must be reconciled with generated live history before any db push.',
  '20261106110001_phase1_curation_community_guard_reconciliation.sql': 'Equivalent source SQL applied and postflight-verified on GH Connect Testnet on 2026-11-10 under MCP migration record phase1_curation_community_guard_reconciliation (generated version 20261110091735). This applies canonical visibility/self-curation checks, per-user quota serialization and community feed cursor parity. The internal GHPV writer and curation count RPC are server-only after Run #251; no curation votes or activity rows were created. Canonical filename/version is not recorded under its original version; reconcile CLI history before future db push. GHC curation credits remain intentionally disabled by the Daily-Claim-only issuance policy.',
  '20261022010019_gh_pi_identities.sql': 'Live Testnet review (2026-11-10) confirmed the unique index uq_gh_pi_identities_gh_user_id exists. Run #250 hardens the application store to fail closed on database lookup errors and to use insert-only identity creation; see docs/TESTNET-RECONCILIATION-2026-11-10.md.',
  '20261107170001_phase7_durable_community_governance.sql': 'Equivalent source SQL applied and postflight-verified on GH Connect Testnet on 2026-11-10 under MCP migration record phase7_durable_community_governance_reconciliation (generated version 20261110085225). The existing idx_gh_community_reports_queue covers the report queue access path; only the missing moderation-actor index was added. Canonical filename/version is not recorded under its original version; reconcile CLI history before future db push.',
  '20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql': 'Phase 3 closeout across PI payout reservation recovery, GHC reward claim replay and GHC membership purchase serialization. Validate that only reserved Pi Testnet requests with no provider payment/txid, no execution start/lease and zero attempts are released; processing/uncertain requests retain funds until authoritative provider reconciliation; exact gross reservation is compensated once; response reasons are owner-scoped; claim replay by pending UUID/rewardId returns one posted credit; and concurrent membership preflight/debit is serialized with active-tier and downgrade guards. Run concurrency and rollback tests on disposable PostgreSQL plus authenticated Pi Testnet before applying to either live environment. REVIEW_REQUIRED and unapplied.' ,
  '20261107180001_marketplace_sku_variants_atomic_inventory.sql': 'Phase 9.3 durable SKU variants and atomic per-variant inventory. Testnet preflight confirms the required legacy listing/order/expiry RPCs and stock trigger exist, the variant table/columns are absent, and there are zero orders. The legacy reservation RPC rename is conditional/idempotent and fails closed if both/neither function names exist. Still validate migration order/history, seller SKU uniqueness, variant replacement atomicity, lock ordering, concurrent oversell attempts, expiry/cancellation release, payment-verification stock commit, legacy-RPC bypass rejection, idempotency conflicts, RLS and service_role ACLs on disposable PostgreSQL. Exercise both GHC and Pi Testnet payment lifecycle with synthetic users before any enablement. This migration remains REVIEW_REQUIRED and unapplied; no live marketplace orders exist, so do not enable finite-stock variant sales until database concurrency and payment-race evidence passes.',
  '20261108120001_gh_community_server_filter_search.sql': 'Phase 10.2 server-side public community search. Validate the exact functional GIN expression/index selection, category filtering, plainto_tsquery semantics, bounded offset/limit, deterministic created_at/id ordering, total/hasMore pagination, public-only privacy scope, service_role-only function ACL, and existing RPC compatibility on disposable PostgreSQL. This migration does not expose private/invite communities or alter membership authority. REVIEW_REQUIRED and unapplied; reconcile Testnet/Mainnet migration histories independently.',
  '20261107190001_marketplace_fulfilment_tracking_timeline.sql': 'Phase 9.4 durable seller fulfilment and buyer tracking. Testnet preflight confirms zero orders and the Phase 21 immutable event journal with actor_source/before_state/after_state and the expected restrictive event_type vocabulary. The source migration reuses the existing journal and extends its original trigger; the 194 SKU migration must run first because this migration snapshots variant fields. It remains REVIEW_REQUIRED and unapplied until disposable PostgreSQL validation proves exact schema compatibility, trigger behavior, legacy-audit import idempotency, and shipping/pickup/digital state transitions.',
  '20261031010002_gh_community_chat_review_membership_order.sql': 'Security-sensitive Community Chat approval ordering fix. Validate owner-only approval, active-membership requirement, idempotent retries, request-state preservation on rejected approval, and conversation membership on disposable PostgreSQL/Testnet before applying.',
  '20261101010001_gh_security_control_plane_retention.sql': 'Security-control-plane retention and bounded cleanup. Validate cleanup query plans, sampled invocation frequency, event expiry behavior, row-lock/concurrency behavior, and service_role-only RPC execution on disposable PostgreSQL before applying; do not infer remote migration status.',
  '20261104170001_marketplace_order_read_cleanup_separation.sql': 'Phase 23 lock-scope hardening. Validate the side-effect-free order snapshot, explicit application cleanup RPC, service_role ACL, expired reservation behavior, and concurrent order transition/cleanup behavior on disposable PostgreSQL and Testnet. Review migration ordering/history before applying.',
  '20261104180001_gh_community_list_memberships_viewer.sql': 'New viewer-scoped community membership read view. Validate grants, RLS/view security semantics, owner/member/non-member visibility, and query plans on disposable PostgreSQL; reconcile target migration history before any application.',
  '20261105160001_pi_wallet_authorization_explicit_consent_only.sql': 'Security-sensitive Pi payout-consent grant replacement. Validate exact identity mapping, user-explicit-only source enforcement, advisory-lock concurrency, superseding of stale active authorizations, audit-event insertion, service_role-only ACLs, and rollback behavior on disposable PostgreSQL/Testnet before applying. Reconcile target migration history first; this migration does not authorize users or enable payouts.',
  '20261105170001_phase3_earnings_ledger_integrity_hardening.sql': 'Financially sensitive append-only PI earnings ledger hardening. Validate trigger behavior, per-user advisory-lock serialization, exact payload-bound idempotency for credit/reserve/settle/release, service_role-only RPC grants, and payout reconciliation on disposable PostgreSQL/Testnet before applying. Additive only; does not execute or enable payouts.',
  '20261106143001_phase9_membership_pi_renewal_strict_provider_guard.sql': 'Phase 9 strict Pi renewal discriminator follow-up. Validate null/missing provider, currency and purpose rejection, service-role-only execution, existing function signature/ACL compatibility and all renewal idempotency cases on disposable PostgreSQL/Testnet; reconcile remote migration history before applying.',
  '20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql': 'Phase 9 membership lifecycle and verified-renewal hardening. Validate canonical PI provider/currency/purpose/product/amount checks, catalog-derived calendar duration (including one bonus month), row/advisory-lock idempotency, 72-hour continuity-only grace (no access during gap), trigger-generated immutable lifecycle events, user-scoped lifecycle RPC, service_role-only ACLs, and expiry sweep behavior on disposable PostgreSQL/Testnet before applying. No auto-renewal, refund, GHC debit, Pi transfer, or Mainnet execution is introduced; reconcile remote migration history first.',
  '20261106090001_gh_community_post_feed_canonical.sql': 'Phase 1 canonical community-post read RPC. Validate active-member authorization, gh_post_viewer_can_read dependency, viewer-specific curation/reaction projection, keyset cursor boundaries, query plan/index use, and service_role-only ACL on disposable PostgreSQL before Testnet application. Read-only; does not mutate posts, votes, rewards, or wallet balances.',
  '20261106130001_gh_story_view_privacy_and_read_performance.sql': 'Phase 2 Stories privacy and read-path hardening. Depends on gh_stories, gh_story_views, gh_story_reactions, gh_follows and ghc_user_blocks. Validate owner/follower/friend/private/matches-only access, bidirectional block denial, idempotent view recording, viewerHasViewed and reaction projections, side-effect-free list RPC, index selection, legacy gh_story_view service-role revocation, and versioned gh_story_view_authorized_v2 service_role-only ACL on disposable PostgreSQL before Testnet application. The app fails closed for view writes until this migration is deployed.',
  '20261106150001_marketplace_listing_report_intake.sql': 'Phase 3 Marketplace durable listing-report intake. Validate listing FK behavior, authenticated actor binding through the server-only RPC, self-report rejection, one-report-per-user/listing idempotency, report reason constraints, RLS deny-all client access, service_role-only table/function privileges, operator-key queue access, row-locked terminal status transitions, and rate-limit failure behavior on disposable PostgreSQL/Testnet before applying. No payment, inventory, order, wallet, GHC, Pi, or payout mutation.',
  '20261022010015_connection_request_intents.sql': 'Product/security review; do not auto-apply.',
  '20261025010001_gh_community_create_idempotency_guard.sql': 'Review community ID-conflict behavior and verify same-owner retries plus cross-owner rejection on disposable PostgreSQL/Testnet before applying; reconcile remote migration history first.',
  '20261027010003_gh_media_upload_finalize_identity.sql': 'Review upload-session finalization against concurrent retries and media asset lifecycle on disposable PostgreSQL; verify asset/session identity matching and service-role ACL before applying.',
  '20261027010004_ghc_transfer_request_idempotency_intent.sql': 'Verify idempotency conflict behavior and unique-key race handling on disposable PostgreSQL before deployment.',
  '20261027010005_ghc_transfer_request_rpc_acl_hardening.sql': 'Verify function ACL and search_path on disposable PostgreSQL; confirm service_role-only execution and no unexpected inherited grants before deployment.',
  '20261025090001_backfill_daily_claim_48h_metadata.sql': 'Review exact pending DAILY_CLAIM_V12 rows and metadata before applying on Testnet. Backfill does not change amounts/status, but unlocks strict claim RPC eligibility after the original 48-hour timestamp; reconcile remote history first.',
  '20261030010002_pi_earnings_payout_requests.sql': 'Financially critical PI earnings payout request/reservation foundation. Validate idempotency payload conflicts, concurrent reservations, fee/gross/net conservation, RLS and service-role ACLs on disposable PostgreSQL; apply only with the matching settlement/recovery migration after review.',
  '20261030010009_phase20_marketplace_net_proceeds.sql': 'Financially critical seller proceeds snapshot and payout-basis replacement. Validate trigger timing against PI/GHC verification, commission rounding and configured fee policy, immutable-row behavior, payout allocations, legacy allocated orders, concurrent requests, RLS and service_role ACLs on disposable PostgreSQL. Verify both payment rails on Pi/GHC Testnet; do not apply until reviewed.',
  '20261030010010_phase21_marketplace_case_event_journal.sql': 'Append-only marketplace lifecycle audit trail. Validate trigger ordering with all order/payment RPCs, actor claim propagation through service-role calls, insert/update event coverage, RLS, immutable trigger behavior, event volume and index performance on disposable PostgreSQL. This records state changes only; it does not implement refunds, chargebacks, dispute decisions or fund settlement. Do not apply until reviewed.',
  '20261030010011_phase22_marketplace_adjustments_and_payout_fencing.sql': 'Financially critical immutable refund/chargeback/dispute adjustment ledger and seller-net payout reservation replacement. Validate dependency order, order and payout lock compatibility, duplicate payload conflicts, partial-refund seller/platform split, allocation conservation, historical gross allocations, RLS and service_role ACLs on disposable PostgreSQL. Provider refunds/chargebacks are not executed by this RPC. Reconcile all order-mutating RPCs and external payout workers before applying; do not apply until reviewed.',
  '20261030010008_phase7_treasury_reporting_and_case_history.sql': 'Financially sensitive treasury reporting and operator case-history layer. Validate every aggregate against independently queried source rows, service-role-only RPC ACLs, append-only event history, case concurrency, RLS, date-window semantics, and read-only behavior on disposable PostgreSQL before Testnet application; no live payout or reservation state is changed.',
  '20261030010003_pi_earnings_payout_settlement_recovery.sql': 'Financially critical PI earnings payout settlement and failure recovery RPCs. Validate exact provider receipt bindings, net-vs-gross conservation, transaction rollback, duplicate receipt handling, authoritative cancellation-only release, and service_role ACLs on disposable PostgreSQL. Server provider verification and Pi Testnet E2E are still required; never auto-apply.',
  '20261028010001_ghc_canonical_identity_state_and_race_hardening.sql': 'Phase 2 identity lifecycle and concurrency hardening. Review existing identity rows, verify status semantics and advisory-lock behavior on disposable PostgreSQL, then validate create/retry/suspend/delete/resolve cases on Testnet before applying.',
  '20261028160000_marketplace_buyer_confirmation_delivery_gate.sql': 'Phase 10 delivery/completion lifecycle gate. Review existing commerce RPC signature and transition policy, then test delivered/service-active, premature confirmation, duplicate confirmation, dispute, and concurrent buyer/seller actions on disposable PostgreSQL and Testnet before applying; reconcile target migration history first.',
  '20261029010001_pi_cashback_attribution_and_period_ledger.sql': 'Financially critical cashback foundation. Validate the additive paying-user attribution, service-role-only RPC ACLs, exact PI atomic-unit math, fixed four-month UTC windows, refund/chargeback attribution, concurrent close retries and entitlement uniqueness on disposable PostgreSQL. This does not integrate payment producers or enable A2U payouts; reconcile target migration history first.',
  '20261029010002_pi_cashback_user_statement_rpc.sql': 'Financially critical user-scoped statement RPC. Validate user isolation, service_role-only execution, no direct table grants, response bounds and compatibility with the period-ledger migration on disposable PostgreSQL; this is read-only and does not enable withdrawals. Reconcile target migration history first.',
  '20261029010003_pi_cashback_period_reconciliation_grace.sql': 'Financially critical period-close wrapper. Validate SECURITY DEFINER ownership, renamed function privileges, seven-day late-revenue reconciliation grace, idempotent close retries and boundary timestamps on disposable PostgreSQL. Reconcile target project migration history before applying; never auto-apply.',
  '20261029010004_pi_cashback_testnet_a2u_payouts.sql': 'Financially critical Testnet-only user cashback A2U payout ledger. Validate service-role-only RPCs, shared global sequence lease, entitlement reservation uniqueness, recipient binding, provider evidence, retry after timeout and no duplicate transfer on disposable PostgreSQL and Pi Testnet. Requires explicit server secrets and funded Testnet app wallet; never enables Mainnet and must not be auto-applied.',
  '20261022010016_community_join_reasons_proposal.sql': 'Proposal only; do not apply without explicit approval.',
  '20261022010017_community_governance_log_proposal.sql': 'Proposal only; do not apply without explicit approval.',
  '20261022010027_gh_messaging_durable.sql': 'Durable messaging; flag remains off until two-user authorization gate passes.',
  '20261022010071_ghc_curation_rewards.sql': 'Curation credit is redistribution; Testnet-first and explicit Mainnet approval required.',
  '20261022010072_gh_curation_pipeline_atomic.sql': 'Review vote/reward/GHPV transaction ordering on disposable PostgreSQL and Testnet.',
  '20261022010073_reputation_event_integrity.sql': 'Review canonical event point values and migration dependencies.',
  '20261022010074_curation_self_vote_guard.sql': 'Historical self-curation denial; the later allowance migration superseded this at that point, and the 2026-11-06 Phase 1 reconciliation migration explicitly restores the final no-self-curation policy consistently across preflight and write paths.',
  '20261022010075_allow_self_curation.sql': 'Historical display-only self-curation allowance; superseded by the 2026-11-06 Phase 1 reconciliation migration, which consistently denies self-curation so it cannot affect independent review or settlement.',
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
  '20261110100001_withdrawal_rpc_acl_and_recovery_atomicity.sql': 'Run #246 security repair. Equivalent source SQL was applied and postflight-verified on GH Connect Testnet on 2026-11-10 under MCP migration record withdrawal_rpc_acl_and_recovery_atomicity (generated version 20261110085344). The canonical filename/version is NOT recorded under its original version; reconcile CLI history before any future db push. Does not execute Pi transfers.',
  '20261110110001_wallet_recovery_reset_lock_race_guard.sql': 'Run #249 additive recovery race guard. Equivalent source SQL was applied and postflight-verified on GH Connect Testnet on 2026-11-10 under MCP migration record wallet_recovery_reset_lock_race_guard (generated version 20261110085351). The canonical filename/version is NOT recorded under its original version; reconcile CLI history before any future db push. Disposable PostgreSQL concurrency testing remains outstanding.',
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
const checklist = `# GreenHaven — Migration Checklist (generated source inventory)\n\n${blockerNote}\n**Generated by:** scripts/generate-migration-inventory.mjs (deterministic; no timestamp)\n**Canonical path:** \`supabase/migrations/*.sql\`\n**On-disk count:** **${files.length}**\n**Classification:** REQUIRED **${counts.REQUIRED}** · REQUIRES_APPROVAL **${counts.REQUIRES_APPROVAL}** · PROPOSAL **${counts.PROPOSAL}** · REVIEW_REQUIRED **${counts.REVIEW_REQUIRED}**\n\nThis is a repository inventory only. It does **not** prove that any migration is applied to Testnet or Mainnet.\n\n## Live Testnet reconciliation snapshot (2026-11-10)\n\n- Target: GH Connect Testnet Supabase (tpckwgdsjlkzscjlxiwe, eu-west-1). Mainnet was not accessed or modified.\n- Nine distinct additive reconciliation operations were applied and verified. Supabase records eleven generated history rows because the idempotent duplicate-index cleanup and RLS policy cleanup were each submitted twice: phase7_durable_community_governance_reconciliation (20261110085225), withdrawal_rpc_acl_and_recovery_atomicity (20261110085344), wallet_recovery_reset_lock_race_guard (20261110085351), phase1_curation_community_guard_reconciliation (20261110091735), server_only_security_definer_rpc_acl_hardening (20261110092119), function_search_path_hardening (20261110092226), and remove_verified_duplicate_indexes (20261110092347 and 20261110092407), rls_policy_dedup_and_initplan_optimization (20261110093142 and 20261110093227), and supporting_foreign_key_indexes (20261110093228).\n- These generated records are not the canonical source filenames' original versions. No original migration history for 1–189 was available, despite the user's manual SQL Editor application. Do not run supabase db push, migration repair, or hand-edit migration history until every existing object and all historical migrations have been reconciled. Never replay migrations 1–189 by assumption.\n- Live schema: 140 public tables, RLS enabled on all 140, 133 policies, 13 intentionally policy-less RLS tables (deny-client pattern), and 0/290 public SECURITY DEFINER functions executable by anon/authenticated. 286 remain service_role-executable; four internal/legacy/disabled helpers retain their pre-existing non-service-role state. The postgres-owned public function default ACL now excludes anon/authenticated. The separate supabase_admin default ACL remains unchanged because the migration role is not a member of supabase_admin.\n- Security advisor: no remaining SECURITY DEFINER client-execution warnings and no mutable search_path warnings. The 13 RLS-enabled/no-policy findings are INFO and must not be “fixed” with generic client policies.\n- Performance advisor: duplicate-index, unindexed-foreign-key, auth RLS initplan and multiple-permissive-policy findings are all zero. 117 unused indexes remain (including the newly added FK indexes on a low-traffic Testnet); do not drop unused indexes without workload evidence.\n- Identity/profile snapshot: 3 Pi identities, 3 public IDs, 4 profiles, 4 account anchors and 213 custom sessions (6 active). One account/profile has no Pi identity, no transactions and no active session; one expired orphan session remains. It was not deleted or auto-linked.\n- Media: gh-media is private, 50 MiB; 39 ready asset rows map one-to-one to 39 storage objects, with no orphan assets/objects or expired open uploads. This matches the current secure signed-upload/authorized-delivery implementation.\n- Economy snapshot: 59 GHC transactions (38 posted, 4 Daily Claim pending, 17 expired); 24 unified earnings-ledger entries; 15 payment intents (8 fulfilled, 5 cancelled, 2 old APPROVED membership intents with no txid/completion/entitlement); 3 active memberships (1 VIP, 2 VVIP); 1 referral attribution but 0 referral rewards; 0 Pi cashback entitlements/periods/payouts; 0 GHC transfer requests; 0 GHC withdrawal requests; 0 bank/seller payout requests. Two Daily Claim holds are over 48 hours and two remain within the lock. Two Treasury cases were opened: membership provider reconciliation and aged Daily Claim reconciliation.\n- Pi earnings payouts: 11 requests (10 released with no provider receipt and one uncertain request with one attempt, no provider ID/txid/verified receipt, no active lease, and a still-reserved ledger hold). Run #256 added this request to the shared A2U review queue (one open item). Do not auto-release or settle the uncertain request; reconcile the provider's single incomplete server-payment lane first.\n- Marketplace: 8 listings (1 active, 3 paused, 4 removed; 4 GHC and 4 PI; no negative/zero availability), 0 orders and no seller payout requests. The single fulfilled Marketplace Pi intent is a listing_fee tied to an existing listing, not an orphan order. Variants table/columns are absent; required base listing/order/expiry RPCs, stock trigger and Phase 21 event-journal constraints exist. Migrations 194–195 remain unapplied; there are no orders to exercise payment/fulfilment. Curation: 0 votes/activity; GHC curation credits remain intentionally disabled by the Daily-Claim-only issuance policy. Community: 1 community, 1 member and 5 posts.\n- The Pi custom identity/session system is populated; an empty Supabase auth.users table does not mean the app has no accounts.\n- Marketplace migration 195 was found incompatible with the existing Phase 21 event-journal schema. Its source has been corrected to reuse the original immutable journal and event vocabulary. Testnet preflight now confirms the expected Phase 21 journal contract; migrations 194–195 remain unapplied pending disposable PostgreSQL validation and transactional inventory/payment/fulfilment tests.\n\n## Apply policy\n\n| Class | Action |\n|---|---|\n| **REQUIRED** | Candidate for operator review; reconcile target schema/history first, apply to disposable PostgreSQL/Testnet, verify, then seek explicit promotion approval. |\n| **REQUIRES_APPROVAL** | Product and security review, then explicit approval. |\n| **PROPOSAL** | **Do not apply** without written approval. |\n| **REVIEW_REQUIRED** | New, unreconciled, or sequencing-sensitive; inspect dependencies and validate on disposable PostgreSQL/Testnet before any application. |\n\n**Never bulk-apply this inventory.** Supabase CLI does not enforce these documentation classifications: any pending SQL file left in the canonical migration directory may be eligible for supabase db push. Do not run supabase db push until every pending file has been individually approved and target history reconciled. Filename order is not proof of migration history or safety. Reconcile Testnet and Mainnet independently, and preserve data.\n\n## Inventory\n\n| # | File | Class | Notes |\n|---:|---|---|---|\n${checklistRows}\n\n## Release-readiness notes\n\n- The current inventory contains **${files.length}** migration files. Counts and row order are generated from the canonical directory.\n- Migrations with newer sequence identifiers are not automatically invalid, but their dependencies, approval status, and target-project history must be reviewed before execution.\n- Historical self-curation guard/allowance migrations conflict; the Phase 1 reconciliation migration is the current final policy and explicitly denies self-curation in both preflight and atomic write paths. Verify the final function definition on disposable PostgreSQL and Testnet before applying.\n- The marketplace reservation migration remains unverified against PostgreSQL. Do not enable finite-stock production sales until concurrency, payment races, expiry, cancellation, and recovery pass.\n- This checklist is not a deployment approval and is not a record of applied migrations.\n`

const manifest = `GH-CONNECT VERIFIED SOURCE MANIFEST\n==================================\ninventory_status=${duplicateVersions.length ? 'BLOCKED_DUPLICATE_VERSION_PREFIXES' : 'OK'}\nduplicate_version_prefixes=${duplicateVersions.map(([version]) => version).join(',')}\nproject_version=${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version}\nmanifest_format_version=1\ncanonical_migrations=${files.length}\nclassification_required=${counts.REQUIRED}\nclassification_requires_approval=${counts.REQUIRES_APPROVAL}\nclassification_proposal=${counts.PROPOSAL}\nclassification_review_required=${counts.REVIEW_REQUIRED}\nsource=supabase/migrations/*.sql\n\nIMPORTANT: This manifest inventories repository files only. It does NOT prove migrations are applied to any Supabase project.\n\nCLASSIFICATION_POLICY:\n  REQUIRED            = candidate for operator review; reconcile target schema/history before applying\n  REQUIRES_APPROVAL   = product/security review before apply\n  PROPOSAL            = do NOT apply without explicit written approval\n  REVIEW_REQUIRED     = unreconciled or sequencing-sensitive; validate on disposable PostgreSQL/Testnet first\n\nAPPLICATION_GUARD: Supabase CLI does not enforce this classification metadata. Do not run db push while any pending migration is unreviewed, a proposal, or awaiting approval.\n\nALL_MIGRATIONS_ORDERED_FOR_REVIEW:\n${files.map((file) => `[${classify(file)}] size=${statSync(join(migrationDir, file)).size} path=supabase/migrations/${file}`).join('\n')}\n`

const sourceManifestPath = join(root, 'MIGRATION-SOURCE-MANIFEST.csv')
const sourceManifest = `filename,classification,bytes\n${files.map((file) => `${file},${classify(file)},${statSync(join(migrationDir, file)).size}`).join('\n')}\n`
const applyRows = files.map((file, index) => {
  const kind = classify(file)
  const action = kind === 'REQUIRED' ? 'REVIEW_THEN_APPLY' : kind === 'REQUIRES_APPROVAL' ? 'HOLD_APPROVAL' : kind === 'PROPOSAL' ? 'DO_NOT_APPLY' : 'HOLD_VALIDATION'
  return `| ${index + 1} | \`${file}\` | ${kind} | ${action} |`
}).join('\n')
const applyOrderPath = join(root, 'supabase', 'TESTNET_APPLY_ORDER.md')
const applyOrder = `# GreenHaven Testnet migration review order\n\n**Generated from:** \`supabase/migrations/*.sql\` and the canonical classification policy in \`scripts/generate-migration-inventory.mjs\`.\n**Current source inventory:** ${files.length} migrations.\n\n> **This is a review order, not permission to apply.** It does not prove remote migration history, database compatibility, or Testnet/Mainnet readiness. See docs/TESTNET-RECONCILIATION-2026-11-10.md for the latest direct Testnet snapshot and custom migration-history entries. Never run \`supabase db push\` while any pending migration is held for review, approval, validation, or marked proposal. Supabase CLI does not enforce these classifications.\n\n## Required operator procedure\n\n1. Export and verify a restorable backup of the target project.\n2. Reconcile \`supabase migration list\` with the target project's migration history; investigate every missing, extra, or divergent version.\n3. Validate each candidate against the exact target schema on a disposable PostgreSQL database.\n4. Apply one approved migration at a time to Testnet, then run its read-only postflight and feature-specific tests.\n5. Keep provider, payout, wallet, GHC, Pi, and Mainnet features disabled until their independent financial/provider gates pass.\n6. Promote to Mainnet only through a separately reviewed release and rollback plan.\n\n## Canonical ordered inventory\n\nThe rows are sorted by the canonical migration identifier for review. Dependencies and approval status take precedence over this display order.\n\n| # | Migration | Classification | Operator action |\n|---:|---|---|---|\n${applyRows}\n\n## Classification meanings\n\n- \`REQUIRED\`: candidate only; review schema/history and test on disposable PostgreSQL/Testnet before explicit approval.\n- \`REVIEW_REQUIRED\`: hold until its named dependency, security, concurrency, and provider checks are completed.\n- \`REQUIRES_APPROVAL\`: hold for explicit product/security approval.\n- \`PROPOSAL\`: do not apply without explicit written approval.\n\n**Never infer applied status from filename order, repository presence, static checks, or this document. Testnet and Mainnet histories must be reconciled independently.**\n`
const outputs = [[checklistPath, checklist], [manifestPath, manifest], [sourceManifestPath, sourceManifest], [applyOrderPath, applyOrder]]
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
