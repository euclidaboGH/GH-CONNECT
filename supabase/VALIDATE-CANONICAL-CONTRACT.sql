-- GH-CONNECT Phase 2 post-install contract validation
-- Read-only assertions. Run only after a LOCAL/disposable clean install first.

DO $$
DECLARE v_missing text;
BEGIN
  WITH required(name) AS (VALUES
    ('gh_account_lifecycle_request'),
    ('gh_ad_verification_record'),
    ('gh_bank_beneficiary_disable'),
    ('gh_bank_payout_apply_reconciliation'),
    ('gh_bank_payout_apply_webhook'),
    ('gh_bank_payout_begin_transfer'),
    ('gh_bank_payout_operator_transition'),
    ('gh_bank_payout_record_submission'),
    ('gh_bank_payout_request'),
    ('gh_bank_payout_resolve_exception'),
    ('gh_company_revenue_event_append'),
    ('gh_creator_get'),
    ('gh_creator_reward_pool_fund'),
    ('gh_creator_reward_settle_funded'),
    ('gh_creator_upsert'),
    ('gh_edit_message'),
    ('gh_media_asset_create'),
    ('gh_media_assets_resolve'),
    ('gh_media_authorize_viewer'),
    ('gh_pin_message'),
    ('gh_post_media_attach'),
    ('gh_reputation_apply_event'),
    ('gh_reputation_get'),
    ('gh_seller_payout_record_pi_confirmation'),
    ('gh_seller_payout_request'),
    ('gh_seller_payout_settle_ghc_atomic'),
    ('gh_seller_payout_transition'),
    ('gh_set_conversation_prefs'),
    ('gh_set_post_archived'),
    ('gh_social_notification_create'),
    ('gh_social_notifications_list'),
    ('gh_social_notifications_mark_read'),
    ('gh_social_notifications_unread_count'),
    ('gh_tip_intent_bind_payment_intent'),
    ('gh_tip_intent_create'),
    ('gh_tip_intent_get_for_tipper'),
    ('gh_tip_settle_ghc_atomic'),
    ('gh_tip_settle_verified'),
    ('ghc_activity_stage_reward'),
    ('ghc_claim_pending'),
    ('ghc_commit_claim_day'),
    ('ghc_complete_orphan_transfer_in'),
    ('ghc_connection_request_accept'),
    ('ghc_connection_request_decline'),
    ('ghc_connection_request_upsert'),
    ('ghc_credit_pack_purchase'),
    ('ghc_curation_redistribute'),
    ('ghc_economic_population_stats'),
    ('ghc_ensure_account_created_at'),
    ('ghc_ensure_public_id'),
    ('ghc_execute_daily_claim_v12'),
    ('ghc_execute_spend'),
    ('ghc_execute_transfer'),
    ('ghc_get_claim_streak'),
    ('ghc_list_orphan_transfer_outs'),
    ('ghc_match_signal_upsert'),
    ('ghc_membership_complete_orphaned_purchase'),
    ('ghc_membership_list_orphan_purchase_candidates'),
    ('ghc_purchase_membership'),
    ('ghc_record_notification_event'),
    ('ghc_referral_attribute'),
    ('ghc_referral_ensure_code'),
    ('ghc_referral_queue_reward'),
    ('ghc_resolve_public_id'),
    ('ghc_settle_referral_reward'),
    ('ghc_stage_pending'),
    ('ghc_wallet_snapshot')
  ), missing AS (
    SELECT r.name FROM required r
    WHERE NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=r.name)
  ) SELECT string_agg(name, ', ' ORDER BY name) INTO v_missing FROM missing;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'Missing application RPCs: %', v_missing; END IF;
END $$;

-- SECURITY DEFINER functions with unsafe/empty search_path.
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path=%')
ORDER BY p.proname;

-- SECURITY DEFINER functions still executable by PUBLIC. Expected result: review/zero unless explicitly justified.
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('public', p.oid, 'EXECUTE')
ORDER BY p.proname;

-- Tables in public without RLS. Review every returned row.
SELECT schemaname, tablename FROM pg_tables t
WHERE schemaname='public' AND NOT EXISTS (
 SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname=t.schemaname AND c.relname=t.tablename AND c.relrowsecurity
) ORDER BY tablename;
