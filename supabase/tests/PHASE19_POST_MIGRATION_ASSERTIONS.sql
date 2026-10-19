-- Run after the Phase 19 migration on disposable PostgreSQL and Testnet.
-- Read-only assertions; raises an error if any security/integrity invariant is missing.
DO $$
DECLARE v_proc regprocedure; v_def text; v_rls boolean;
BEGIN
  FOREACH v_proc IN ARRAY ARRAY[
    to_regprocedure('public.ghc_execute_transfer(text,text,numeric,text,text,text)'),
    to_regprocedure('public.gh_tip_settle_ghc_atomic(text,text,numeric)'),
    to_regprocedure('public.gh_creator_reward_pool_fund(text,numeric,text)'),
    to_regprocedure('public.gh_creator_reward_settle_funded(text)'),
    to_regprocedure('public.gh_media_authorize_viewer(text,text)'),
    to_regprocedure('public.gh_media_assets_resolve(text,text[])'),
    to_regprocedure('public.gh_seller_payout_record_pi_confirmation(text,text,text,text,numeric,text,boolean,text)'),
    to_regprocedure('public.gh_seller_payout_transition(text,text,text,text)')
  ] LOOP
    IF v_proc IS NULL THEN RAISE EXCEPTION 'Required Phase 19 function missing'; END IF;
    IF has_function_privilege('anon',v_proc,'EXECUTE') OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
      RAISE EXCEPTION 'Client role unexpectedly has EXECUTE on %',v_proc;
    END IF;
    IF NOT has_function_privilege('service_role',v_proc,'EXECUTE') THEN
      RAISE EXCEPTION 'service_role lacks EXECUTE on %',v_proc;
    END IF;
  END LOOP;

  v_def := pg_get_functiondef(to_regprocedure('public.ghc_execute_transfer(text,text,numeric,text,text,text)'));
  IF position('p_sender_id < p_to_user_id' in v_def)=0 OR position('ghc_balance:' in v_def)=0 OR position('INVALID_AMOUNT_PRECISION' in v_def)=0 OR position('TRANSFER_LIMITS_UNAVAILABLE' in v_def)=0 THEN
    RAISE EXCEPTION 'Shared GHC transfer does not have canonical two-party locking and precision guard';
  END IF;

  FOREACH v_proc IN ARRAY ARRAY[
    to_regprocedure('public.gh_tip_settle_ghc_atomic(text,text,numeric)'),
    to_regprocedure('public.gh_creator_reward_pool_fund(text,numeric,text)'),
    to_regprocedure('public.gh_creator_reward_settle_funded(text)')
  ] LOOP
    v_def := pg_get_functiondef(v_proc);
    IF position('SECURITY DEFINER' in upper(v_def))=0 OR position('search_path' in lower(v_def))=0 OR position('public' in lower(v_def))=0 THEN
      RAISE EXCEPTION 'Security definer/search_path invariant failed for %',v_proc;
    END IF;
  END LOOP;

  FOREACH v_def IN ARRAY ARRAY['gh_tip_ghc_settlements','gh_creator_reward_pool_operators','gh_creator_reward_pool_movements'] LOOP
    SELECT c.relrowsecurity INTO v_rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=v_def;
    IF v_rls IS DISTINCT FROM true THEN RAISE EXCEPTION 'RLS is not enabled for public.%',v_def; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=v_def AND p.policyname LIKE '%no_client%') THEN
      RAISE EXCEPTION 'Client-deny policy missing for public.%',v_def;
    END IF;
  END LOOP;
  RAISE NOTICE 'Phase 19 post-migration assertions passed';
END $$;
