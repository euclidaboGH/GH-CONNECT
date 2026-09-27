-- RPC ACL lockdown (idempotent / partial-DB safe)
-- REVOKE PUBLIC execute; GRANT service_role only.
-- Apply on BOTH Mainnet and Testnet after core migrations.
-- Does not alter table data or function bodies.

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_block_set(text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_block_set(text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_block_set(text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_comment_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_comment_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_comment_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_comment_list(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_comment_list(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_comment_list(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_join(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_join(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_join(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_join_decide(text, text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_join_decide(text, text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_join_decide(text, text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_leave(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_leave(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_leave(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_list_public(integer) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_list_public(integer) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_list_public(integer)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_member_role(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_member_role(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_member_role(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_community_set_role(text, text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_community_set_role(text, text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_community_set_role(text, text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_follow_list(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_follow_list(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_follow_list(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_follow_set(text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_follow_set(text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_follow_set(text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_listing_get(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_get(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_listing_get(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_listing_upsert(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_listing_upsert(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_listing_upsert(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_order_get(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_get(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_order_get(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_order_upsert(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_order_upsert(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_order_upsert(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_marketplace_orders_list_for_user(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_marketplace_orders_list_for_user(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_marketplace_orders_list_for_user(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_mute_set(text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_mute_set(text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_mute_set(text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_poll_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_poll_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_poll_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_poll_vote(text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_poll_vote(text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_poll_vote(text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_post_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_post_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_post_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_post_list_feed(text, integer, bigint) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_post_list_feed(text, integer, bigint) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_post_list_feed(text, integer, bigint)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_post_soft_delete(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_post_soft_delete(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_post_soft_delete(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_reaction_toggle(text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_reaction_toggle(text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_reaction_toggle(text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_restrict_set(text, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_restrict_set(text, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_restrict_set(text, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_save_toggle(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_save_toggle(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_save_toggle(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_story_create(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_story_create(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_story_create(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_story_list_active(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_story_list_active(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_story_list_active(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gh_story_view(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gh_story_view(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.gh_story_view(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_accept_transfer_request(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_accept_transfer_request(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_accept_transfer_request(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_activity_try_grant(text, text, text, numeric, numeric, numeric)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_available_balance(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_available_balance(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_available_balance(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_cancel_transfer_request(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_cancel_transfer_request(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_cancel_transfer_request(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_claim_pending(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_claim_pending(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_claim_pending(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_commit_claim_day(text, date, int, int, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_commit_claim_day(text, date, int, int, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_commit_claim_day(text, date, int, int, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_connection_request_accept(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_connection_request_accept(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_connection_request_accept(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_connection_request_decline(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_connection_request_decline(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_connection_request_decline(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_connection_request_upsert(text, text, jsonb, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_connection_request_upsert(text, text, jsonb, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_connection_request_upsert(text, text, jsonb, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_create_transfer_request(text, text, numeric, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_create_transfer_request(text, text, numeric, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_decline_transfer_request(text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_decline_transfer_request(text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_decline_transfer_request(text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_economic_population_stats() FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_economic_population_stats() TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_economic_population_stats()';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_ensure_account_created_at(text, timestamptz) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_ensure_account_created_at(text, timestamptz) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_ensure_account_created_at(text, timestamptz)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_ensure_public_id(text, text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_execute_daily_claim_v12(text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_execute_daily_claim_v12(text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_execute_daily_claim_v12(text, date, int, int, text, numeric, numeric, numeric, numeric, numeric, numeric, text, boolean)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_execute_spend(text, numeric, text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_execute_spend(text, numeric, text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_execute_transfer(text, text, numeric, text, text, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_expire_request_if_needed(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_expire_request_if_needed(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_expire_request_if_needed(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_get_claim_streak(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_get_claim_streak(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_get_claim_streak(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_get_global_demand(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_get_global_demand(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_get_global_demand(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_membership_upsert(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_membership_upsert(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_membership_upsert(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_payment_intent_by_provider(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_provider(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_payment_intent_by_provider(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_payment_intent_get(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_get(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_payment_intent_get(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_payment_intent_upsert(jsonb) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_upsert(jsonb) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_payment_intent_upsert(jsonb)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_record_global_demand(text, numeric) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_record_global_demand(text, numeric) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_record_global_demand(text, numeric)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_record_notification_event(text, text, text, text, text, text, jsonb, text, timestamptz)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_resolve_public_id(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_resolve_public_id(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_resolve_public_id(text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_stage_pending(text, numeric, text, text, text, text, integer, bigint, integer, text)';
  END;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ghc_wallet_snapshot(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ghc_wallet_snapshot(text) TO service_role';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: public.ghc_wallet_snapshot(text)';
  END;
END $$;

