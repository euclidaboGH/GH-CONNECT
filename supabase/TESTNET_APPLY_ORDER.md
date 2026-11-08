# GreenHaven Testnet migration review order

**Generated from:** `supabase/migrations/*.sql` and the canonical classification policy in `scripts/generate-migration-inventory.mjs`.
**Current source inventory:** 198 migrations.

> **This is a review order, not permission to apply.** It does not prove remote migration history, database compatibility, or Testnet/Mainnet readiness. Never run `supabase db push` while any pending migration is held for review, approval, validation, or marked proposal. Supabase CLI does not enforce these classifications.

## Required operator procedure

1. Export and verify a restorable backup of the target project.
2. Reconcile `supabase migration list` with the target project's migration history; investigate every missing, extra, or divergent version.
3. Validate each candidate against the exact target schema on a disposable PostgreSQL database.
4. Apply one approved migration at a time to Testnet, then run its read-only postflight and feature-specific tests.
5. Keep provider, payout, wallet, GHC, Pi, and Mainnet features disabled until their independent financial/provider gates pass.
6. Promote to Mainnet only through a separately reviewed release and rollback plan.

## Canonical ordered inventory

The rows are sorted by the canonical migration identifier for review. Dependencies and approval status take precedence over this display order.

| # | Migration | Classification | Operator action |
|---:|---|---|---|
| 1 | `20261022010001_ghc_economy_ledger.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 2 | `20261022010002_ghc_economy_events_rls.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 3 | `20261022010003_ghc_notification_events.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 4 | `20261022010004_ghc_public_identities.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 5 | `20261022010005_ghc_rls_tighten_events.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 6 | `20261022010006_ghc_transfer_request_rpcs.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 7 | `20261022010007_ghc_account_and_claim.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 8 | `20261022010008_economy_v12_claim_streak_and_population.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 9 | `20261022010009_economy_v12_atomic_daily_claim.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 10 | `20261022010010_economy_v12_telemetry_note.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 11 | `20261022010011_ghc_ledger_spend_rpc.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 12 | `20261022010012_membership_entitlements_and_activity_caps.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 13 | `20261022010013_pi_payment_intents_durable.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 14 | `20261022010014_p0_activity_governor_durable.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 15 | `20261022010015_connection_request_intents.sql` | REQUIRES_APPROVAL | HOLD_APPROVAL |
| 16 | `20261022010016_community_join_reasons_proposal.sql` | PROPOSAL | DO_NOT_APPLY |
| 17 | `20261022010017_community_governance_log_proposal.sql` | PROPOSAL | DO_NOT_APPLY |
| 18 | `20261022010018_ghc_spend_sign_and_idempotency.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 19 | `20261022010019_gh_pi_identities.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 20 | `20261022010020_gh_sessions.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 21 | `20261022010021_gh_step_ups.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 22 | `20261022010022_gh_webauthn_credentials.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 23 | `20261022010023_ghc_wallet_snapshot.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 24 | `20261022010024_marketplace_orders_durable.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 25 | `20261022010025_marketplace_listings_and_list_rpc.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 26 | `20261022010026_verification_requests_durable.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 27 | `20261022010027_gh_messaging_durable.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 28 | `20261022010028_gh_user_profiles_and_progress.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 29 | `20261022010029_ghc_stage_pending.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 30 | `20261022010030_ghc_stage_pending_limits.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 31 | `20261022010031_ghc_ledger_rpc_acl.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 32 | `20261022010032_ghc_user_accounts_rls_lockdown.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 33 | `20261022010033_gh_communities_core.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 34 | `20261022010034_gh_pass5_soft_limits_polls.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 35 | `20261022010035_gh_poll_vote_validate.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 36 | `20261022010036_gh_social_core.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 37 | `20261022010037_gh_poll_vote_authoritative.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 38 | `20261022010038_gh_post_list_feed_order_fix.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 39 | `20261022010039_rpc_acl_lockdown.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 40 | `20261022010040_ghc_withdrawal_requests.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 41 | `20261022010041_gh_reaction_multi_type.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 42 | `20261022010042_gh_content_events.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 43 | `20261022010043_gh_content_attention_read.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 44 | `20261022010044_gh_content_event_access_guard.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 45 | `20261022010045_gh_post_curation.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 46 | `20261022010046_gh_reputation.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 47 | `20261022010047_gh_creator_studio.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 48 | `20261022010048_gh_ad_verification.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 49 | `20261022010049_gh_media_assets.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 50 | `20261022010050_gh_follow_status.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 51 | `20261022010051_gh_social_notifications.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 52 | `20261022010052_gh_search.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 53 | `20261022010053_gh_post_shares.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 54 | `20261022010054_gh_notif_share_type.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 55 | `20261022010055_gh_messaging_edit_pin_prefs.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 56 | `20261022010056_gh_post_archive_quote.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 57 | `20261022010057_ghc_balance_lock_and_spendable.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 58 | `20261022010058_ghc_withdrawal_settle_atomic.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 59 | `20261022010059_ghc_activity_stage_atomic.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 60 | `20261022010060_ghc_activity_stage_lock_align.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 61 | `20261022010061_ghpv_judgment_infrastructure.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 62 | `20261022010062_ghpv_curation_weight_and_settle.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 63 | `20261022010063_gh_post_list_feed_stable_cursor.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 64 | `20261022010064_gh_comment_stable_cursor.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 65 | `20261022010065_ghc_wallet_snapshot_spendable.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 66 | `20261022010066_ghpv_curator_calibration_apply.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 67 | `20261022010067_ghpv_active_weight_set_semantics.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 68 | `20261022010068_ghpv_settlement_engine.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 69 | `20261022010069_match_signals_durable.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 70 | `20261022010070_ghpv_calibration_bounds.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 71 | `20261022010071_ghc_curation_rewards.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 72 | `20261022010072_gh_curation_pipeline_atomic.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 73 | `20261022010073_reputation_event_integrity.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 74 | `20261022010074_curation_self_vote_guard.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 75 | `20261022010075_allow_self_curation.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 76 | `20261022010076_daily_claim_48h_lock.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 77 | `20261022010077_ghc_daily_claim_only_issuance.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 78 | `20261022010078_atomic_membership_purchase.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 79 | `20261022010079_atomic_marketplace_inventory_reservation.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 80 | `20261022010080_gh_engagement_rosters.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 81 | `20261022010081_marketplace_stale_payment_claim_recovery.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 82 | `20261022010082_membership_orphaned_purchase_recovery.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 83 | `20261022010083_transfer_pair_orphan_recovery.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 84 | `20261022010084_referral_programme.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 85 | `20261022010085_issuance_guard_referral_and_curation_redistribute.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 86 | `20261022010086_curation_redistribute_balance_funded.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 87 | `20261022010087_gh_private_media_references_and_viewer_authz.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 88 | `20261022010088_ghpv_soft_delete_quality_cleanup.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 89 | `20261022010089_gh_comment_media_attachments.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 90 | `20261022010090_ghpv_soft_delete_atomic.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 91 | `20261022010091_company_revenue_event_journal.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 92 | `20261022010092_gh_post_list_feed_curation_fields.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 93 | `20261022010093_ghc_credit_pack_purchase.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 94 | `20261022010094_pi_payment_intent_idempotency_lookup.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 95 | `20261022010095_pi_payment_intent_atomic_transitions.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 96 | `20261022010096_gh_social_notifications_types_extend.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 97 | `20261022010097_gh_social_canonical_visibility.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 98 | `20261022010098_gh_social_engagement_write_integrity.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 99 | `20261022010099_ENSURE_social_engagement_rpcs.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 100 | `20261022010100_pgrst_reload_social_rpcs.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 101 | `20261022010101_gh_content_rewards.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 102 | `20261022010102_gh_profile_content_library.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 103 | `20261022010103_gh_post_reaction_roster_visibility_guard.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 104 | `20261022010104_gh_story_creator_upgrade.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 105 | `20261022010105_gh_messaging_presence_delivery_receipts.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 106 | `20261022010106_gh_story_reactions.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 107 | `20261022010107_gh_post_created_notifications.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 108 | `20261022010108_gh_system_announcements.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 109 | `20261022010109_gh_post_restore_owner_window.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 110 | `20261022010110_gh_lifecycle_payout_quality_foundation.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 111 | `20261022010111_gh_verified_tip_settlement_payout_reconciliation.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 112 | `20261022010112_ghc_tip_and_creator_reward_atomic_settlement.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 113 | `20261022010113_pi_a2u_sdk_execution_orchestration.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 114 | `20261022010114_ghc_atomic_seller_payout_settlement.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 115 | `20261022010115_paystack_ngn_beneficiaries_and_payouts.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 116 | `20261022120001_gh_marketplace_saved_listings.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 117 | `20261022120002_gh_social_economy_wallet_bridge.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 118 | `20261022120003_gh_social_economy_settlement_projection.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 119 | `20261022120004_gh_social_economy_control_plane.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 120 | `20261022120005_gh_reputation_social_events.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 121 | `20261022130001_marketplace_commerce_v2.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 122 | `20261023000001_membership_payment_reconciliation_v2.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 123 | `20261023010001_ghc_transaction_correlation_envelope.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 124 | `20261023010002_ghc_wallet_v2_authoritative_snapshot.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 125 | `20261023010003_gh_messaging_v2.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 126 | `20261023020001_gh_notification_realtime_event_platform.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 127 | `20261023030001_gh_community_platform_v2.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 128 | `20261023030002_gh_reputation_curation_intelligence_v2.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 129 | `20261023040001_gh_pulse_media_platform_v2.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 130 | `20261023040002_gh_security_control_plane_v2.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 131 | `20261023040003_gh_feed_engagement_batch_v2.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 132 | `20261025010001_gh_community_create_idempotency_guard.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 133 | `20261025090001_backfill_daily_claim_48h_metadata.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 134 | `20261027010001_gh_media_upload_session_immutable_identity.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 135 | `20261027010002_gh_media_asset_create_immutable_identity.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 136 | `20261027010003_gh_media_upload_finalize_identity.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 137 | `20261027010004_ghc_transfer_request_idempotency_intent.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 138 | `20261027010005_ghc_transfer_request_rpc_acl_hardening.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 139 | `20261028010001_ghc_canonical_identity_state_and_race_hardening.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 140 | `20261028160000_marketplace_buyer_confirmation_delivery_gate.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 141 | `20261029010001_pi_cashback_attribution_and_period_ledger.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 142 | `20261029010002_pi_cashback_user_statement_rpc.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 143 | `20261029010003_pi_cashback_period_reconciliation_grace.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 144 | `20261029010004_pi_cashback_testnet_a2u_payouts.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 145 | `20261029010005_pi_identity_wallet_authorization.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 146 | `20261029010006_gh_unified_earnings_ledger.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 147 | `20261029010007_gh_earnings_reward_adapters.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 148 | `20261029010008_pi_cashback_phase5_attribution_reconcile.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 149 | `20261029010009_pi_a2u_shared_orchestration.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 150 | `20261029010010_gh_earnings_available_balance_phase6.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 151 | `20261029010011_gh_earnings_withdrawal_fee_3pct.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 152 | `20261029010012_gh_charity_utility_accounting.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 153 | `20261029010013_pi_cashback_quarterly_0_5pct.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 154 | `20261030010001_registration_bonus_v2_reconciliation.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 155 | `20261030010002_pi_earnings_payout_requests.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 156 | `20261030010003_pi_earnings_payout_settlement_recovery.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 157 | `20261030010004_pi_earnings_payout_execution_worker.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 158 | `20261030010005_pi_earnings_payout_worker_lease_heartbeat.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 159 | `20261030010006_pi_earnings_receipt_and_lease_fencing.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 160 | `20261030010007_pi_a2u_shared_sequence_lane.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 161 | `20261030010008_phase7_treasury_reporting_and_case_history.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 162 | `20261030010009_phase20_marketplace_net_proceeds.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 163 | `20261030010010_phase21_marketplace_case_event_journal.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 164 | `20261030010011_phase22_marketplace_adjustments_and_payout_fencing.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 165 | `20261030010012_phase23_treasury_community_reconciliation.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 166 | `20261030010013_phase24_financial_exception_detail.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 167 | `20261030010014_phase25_operational_financial_workflows.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 168 | `20261030010015_phase26_operational_execution_paths.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 169 | `20261031010001_gh_community_chat_governance.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 170 | `20261031010002_gh_community_chat_review_membership_order.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 171 | `20261101010001_gh_security_control_plane_retention.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 172 | `20261101090001_pi_wallet_authorization_get_hasmapping_fix.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 173 | `20261101140001_ensure_earnings_payout_policy_fee_bps.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 174 | `20261101150001_fix_notification_list_createdAt_order.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 175 | `20261101160001_harden_notification_rpc_execute_privileges.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 176 | `20261101160002_marketplace_atomic_order_transitions.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 177 | `20261104170001_marketplace_order_read_cleanup_separation.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 178 | `20261104180001_gh_community_list_memberships_viewer.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 179 | `20261105160001_pi_wallet_authorization_explicit_consent_only.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 180 | `20261105170001_phase3_earnings_ledger_integrity_hardening.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 181 | `20261105200001_withdrawal_pin_security.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 182 | `20261106080001_gh_reputation_intelligence_refresh_recovery.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 183 | `20261106090001_gh_community_post_feed_canonical.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 184 | `20261106110001_phase1_curation_community_guard_reconciliation.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 185 | `20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 186 | `20261106130001_gh_story_view_privacy_and_read_performance.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 187 | `20261106143001_phase9_membership_pi_renewal_strict_provider_guard.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 188 | `20261106150001_marketplace_listing_report_intake.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 189 | `20261106170001_phase8_verified_mission_achievements.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 190 | `20261107120001_withdrawal_pin_recovery_questions.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 191 | `20261107130001_wallet_security_hardening.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 192 | `20261107160001_membership_active_tier_downgrade_guard.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 193 | `20261107170001_phase7_durable_community_governance.sql` | REQUIRED | REVIEW_THEN_APPLY |
| 194 | `20261107180001_marketplace_sku_variants_atomic_inventory.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 195 | `20261107190001_marketplace_fulfilment_tracking_timeline.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 196 | `20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 197 | `20261108120001_gh_community_server_filter_search.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |
| 198 | `20261108150001_repair_pin_storage_and_payout_release.sql` | REVIEW_REQUIRED | HOLD_VALIDATION |

## Classification meanings

- `REQUIRED`: candidate only; review schema/history and test on disposable PostgreSQL/Testnet before explicit approval.
- `REVIEW_REQUIRED`: hold until its named dependency, security, concurrency, and provider checks are completed.
- `REQUIRES_APPROVAL`: hold for explicit product/security approval.
- `PROPOSAL`: do not apply without explicit written approval.

**Never infer applied status from filename order, repository presence, static checks, or this document. Testnet and Mainnet histories must be reconciled independently.**
