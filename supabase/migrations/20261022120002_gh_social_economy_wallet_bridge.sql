-- GreenHaven Phase 14.1 — social/economy bridge.
-- Purpose: make balance-funded curation visible as a durable content reward and
-- keep the wallet UI synchronized with the authoritative ledger.
-- IMPORTANT: this is redistribution, not new GHC issuance.

ALTER TABLE public.gh_content_rewards
  ADD COLUMN IF NOT EXISTS curation_funded numeric(24, 8) NOT NULL DEFAULT 0
    CHECK (curation_funded >= 0);

COMMENT ON COLUMN public.gh_content_rewards.curation_funded IS
  'Cumulative GHC actually contributed by curators to this post through balance-funded redistribution. Not newly issued GHC.';

CREATE OR REPLACE FUNCTION public.gh_content_reward_get_public(p_post_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_post_id, ''));
  v_row public.gh_content_rewards%ROWTYPE;
  v_contrib jsonb := '[]'::jsonb;
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;

  SELECT * INTO v_row FROM public.gh_content_rewards WHERE post_id = v_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'enabled', false,
      'status', 'inactive',
      'totalEarned', null,
      'authorReward', null,
      'curationReward', null,
      'curationFunded', 0
    );
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'username', c.username,
      'amount', c.amount
    ) ORDER BY c.amount DESC, c.username ASC
  ), '[]'::jsonb)
  INTO v_contrib
  FROM (
    SELECT username, amount
    FROM public.gh_content_reward_contributors
    WHERE post_id = v_id
    ORDER BY amount DESC, username ASC
    LIMIT 10
  ) c;

  RETURN jsonb_build_object(
    'ok', true,
    'enabled', v_row.enabled,
    'status', v_row.status,
    'totalEarned', v_row.total_earned,
    'authorReward', v_row.author_reward,
    'curationReward', v_row.curation_reward,
    'curationFunded', v_row.curation_funded,
    'upvoteImpact', v_row.upvote_impact,
    'downvoteImpact', v_row.downvote_impact,
    'netImpact', v_row.net_impact,
    'currency', v_row.currency,
    'topContributors', v_contrib,
    'finalizedAt', v_row.finalized_at,
    'distributedAt', v_row.distributed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_content_reward_get_public(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_content_reward_get_public(text) TO service_role;

CREATE OR REPLACE FUNCTION public.ghc_curation_redistribute(
  p_voter_id text,
  p_author_id text,
  p_post_id text,
  p_amount numeric,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric;
  v_ref text := trim(COALESCE(p_reference_id, ''));
  v_debit_id uuid;
  v_credit_id uuid;
  v_now timestamptz := now();
  v_amount numeric := round(COALESCE(p_amount, 0), 4);
  v_post_author text;
  v_choice text;
  v_username text;
BEGIN
  IF trim(COALESCE(p_voter_id, '')) = ''
     OR trim(COALESCE(p_author_id, '')) = ''
     OR trim(COALESCE(p_post_id, '')) = ''
     OR v_ref = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  IF p_voter_id = p_author_id THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'reason', 'SELF_VOTE');
  END IF;

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'reason', 'ZERO_AMOUNT');
  END IF;
  IF v_amount > 1 THEN v_amount := 1; END IF;

  -- The RPC itself derives the post owner and active vote; the route cannot
  -- redirect a contribution to an arbitrary account.
  SELECT author_id INTO v_post_author
  FROM public.gh_posts
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;
  IF v_post_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'POST_NOT_FOUND');
  END IF;
  IF v_post_author <> trim(p_author_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTHOR_MISMATCH');
  END IF;

  SELECT choice INTO v_choice
  FROM public.gh_post_curations
  WHERE post_id = trim(p_post_id) AND user_id = trim(p_voter_id);
  IF v_choice <> 'upvote' THEN
    RETURN jsonb_build_object('ok', true, 'credited', false, 'reason', 'UPVOTE_NOT_ACTIVE');
  END IF;

  -- Idempotent replay. Existing ledger evidence is the authority.
  IF EXISTS (
    SELECT 1 FROM public.ghc_transactions
    WHERE reference_id = v_ref
      AND kind = 'transfer_out'
      AND status = 'posted'
      AND source_event = 'CURATION_REDISTRIBUTE_V1'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'referenceId', v_ref);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ghc_balance:' || trim(p_voter_id)));
  PERFORM pg_advisory_xact_lock(hashtext('ghc_curation_redist:' || trim(p_post_id) || ':' || trim(p_voter_id)));

  v_available := public.ghc_available_balance(trim(p_voter_id));
  IF v_available < v_amount THEN
    RETURN jsonb_build_object(
      'ok', true,
      'credited', false,
      'amount', 0,
      'reason', 'INSUFFICIENT_SPENDABLE',
      'availableBalance', greatest(0, v_available)
    );
  END IF;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id,
    counterparty_id, metadata, posted_at
  ) VALUES (
    trim(p_voter_id), 'transfer_out', -v_amount, 'posted',
    'Curation contribution', 'CURATION_REDISTRIBUTE_V1', v_ref,
    trim(p_author_id),
    jsonb_build_object('postId', trim(p_post_id), 'redistribute', true), v_now
  ) RETURNING id INTO v_debit_id;

  INSERT INTO public.ghc_transactions (
    user_id, kind, amount, status, reason, source_event, reference_id,
    counterparty_id, metadata, posted_at
  ) VALUES (
    trim(p_author_id), 'transfer_in', v_amount, 'posted',
    'Curation reward', 'CURATION_REDISTRIBUTE_V1', v_ref,
    trim(p_voter_id),
    jsonb_build_object('postId', trim(p_post_id), 'redistribute', true), v_now
  ) RETURNING id INTO v_credit_id;

  -- The public content reward is an audit/display projection of actual ledger
  -- movement. It is never a source of GHC and never mints value.
  INSERT INTO public.gh_content_rewards (
    post_id, status, enabled, total_earned, author_reward,
    curation_reward, curation_funded, epoch_key, metadata, updated_at
  ) VALUES (
    trim(p_post_id), 'accruing', true, v_amount, v_amount,
    0, v_amount, 'CURATION_REDISTRIBUTE_V1',
    jsonb_build_object('fundingSource', 'curator_wallet_redistribution'), v_now
  )
  ON CONFLICT (post_id) DO UPDATE SET
    status = CASE
      WHEN public.gh_content_rewards.status = 'voided' THEN 'accruing'
      ELSE public.gh_content_rewards.status
    END,
    enabled = true,
    total_earned = public.gh_content_rewards.total_earned + EXCLUDED.total_earned,
    author_reward = public.gh_content_rewards.author_reward + EXCLUDED.author_reward,
    curation_funded = public.gh_content_rewards.curation_funded + EXCLUDED.curation_funded,
    epoch_key = COALESCE(public.gh_content_rewards.epoch_key, EXCLUDED.epoch_key),
    metadata = public.gh_content_rewards.metadata || EXCLUDED.metadata,
    updated_at = v_now;

  SELECT COALESCE(NULLIF(trim(username), ''), 'member') INTO v_username
  FROM public.gh_user_profiles
  WHERE gh_user_id = trim(p_voter_id)
  LIMIT 1;
  v_username := COALESCE(v_username, 'member');

  INSERT INTO public.gh_content_reward_contributors (post_id, user_id, username, amount, rank)
  VALUES (trim(p_post_id), trim(p_voter_id), v_username, v_amount, 0)
  ON CONFLICT (post_id, user_id) DO UPDATE SET
    username = EXCLUDED.username,
    amount = public.gh_content_reward_contributors.amount + EXCLUDED.amount,
    rank = 0;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'credited', true,
    'amount', v_amount,
    'referenceId', v_ref,
    'debitId', v_debit_id,
    'creditId', v_credit_id,
    'contentRewardRecorded', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_curation_redistribute(text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_curation_redistribute(text, text, text, numeric, text) TO service_role;

COMMENT ON FUNCTION public.ghc_curation_redistribute(text, text, text, numeric, text) IS
  'Balance-funded curation contribution: validates the active upvote and post owner, atomically transfers existing GHC to the creator, and records a public content-reward projection. No issuance.';
