-- =============================================================================
-- GH-CONNECT — Content reward state (public display + system settlement)
-- Forward-only. Do NOT apply until Testnet operator gate.
--
-- Security:
-- - Client RLS deny-all
-- - Writes only via SECURITY DEFINER RPCs callable by service_role
-- - Votes do NOT auto-insert reward rows (no vote→mint)
-- - Distribution to ledger is a separate economy path (not in this migration)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gh_content_rewards (
  post_id           text PRIMARY KEY,
  status            text NOT NULL DEFAULT 'inactive'
                    CHECK (status IN ('inactive', 'accruing', 'finalized', 'distributed', 'voided')),
  enabled           boolean NOT NULL DEFAULT false,
  total_earned      numeric(24, 8) NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  author_reward     numeric(24, 8) NOT NULL DEFAULT 0 CHECK (author_reward >= 0),
  curation_reward   numeric(24, 8) NOT NULL DEFAULT 0 CHECK (curation_reward >= 0),
  upvote_impact     numeric(24, 8) NOT NULL DEFAULT 0,
  downvote_impact   numeric(24, 8) NOT NULL DEFAULT 0,
  net_impact        numeric(24, 8) NOT NULL DEFAULT 0,
  currency          text NOT NULL DEFAULT 'GHC' CHECK (currency = 'GHC'),
  epoch_key         text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  finalized_at      timestamptz,
  distributed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gh_content_rewards_status
  ON public.gh_content_rewards (status)
  WHERE status <> 'inactive';

ALTER TABLE public.gh_content_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_content_rewards_no_client ON public.gh_content_rewards;
CREATE POLICY gh_content_rewards_no_client ON public.gh_content_rewards
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_content_rewards IS
  'Public content reward totals. System-written only. Votes do not mint GHC.';

-- Optional public curator previews (no private wallet data)
CREATE TABLE IF NOT EXISTS public.gh_content_reward_contributors (
  post_id     text NOT NULL REFERENCES public.gh_content_rewards(post_id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  username    text NOT NULL,
  amount      numeric(24, 8) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  rank        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.gh_content_reward_contributors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_content_reward_contributors_no_client ON public.gh_content_reward_contributors;
CREATE POLICY gh_content_reward_contributors_no_client ON public.gh_content_reward_contributors
  FOR ALL USING (false) WITH CHECK (false);

/**
 * Public read of content reward for a post.
 * Safe fields only. service_role execute.
 */
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
      'curationReward', null
    );
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'username', c.username,
      'amount', c.amount
    ) ORDER BY c.rank ASC, c.amount DESC
  ), '[]'::jsonb)
  INTO v_contrib
  FROM (
    SELECT username, amount, rank
    FROM public.gh_content_reward_contributors
    WHERE post_id = v_id
    ORDER BY rank ASC, amount DESC
    LIMIT 10
  ) c;

  RETURN jsonb_build_object(
    'ok', true,
    'enabled', v_row.enabled,
    'status', v_row.status,
    'totalEarned', v_row.total_earned,
    'authorReward', v_row.author_reward,
    'curationReward', v_row.curation_reward,
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

REVOKE ALL ON FUNCTION public.gh_content_reward_get_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_content_reward_get_public(text) TO service_role;

/**
 * System upsert of content reward totals (service_role only).
 * Does not touch ghc_transactions / ledger — distribution is a separate step.
 */
CREATE OR REPLACE FUNCTION public.gh_content_reward_system_upsert(
  p_post_id text,
  p_status text,
  p_enabled boolean,
  p_total_earned numeric,
  p_author_reward numeric,
  p_curation_reward numeric,
  p_upvote_impact numeric DEFAULT 0,
  p_downvote_impact numeric DEFAULT 0,
  p_net_impact numeric DEFAULT 0,
  p_epoch_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_post_id, ''));
  v_status text := lower(trim(COALESCE(p_status, 'inactive')));
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;
  IF v_status NOT IN ('inactive', 'accruing', 'finalized', 'distributed', 'voided') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS');
  END IF;
  IF COALESCE(p_total_earned, 0) < 0 OR COALESCE(p_author_reward, 0) < 0 OR COALESCE(p_curation_reward, 0) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NEGATIVE_AMOUNT');
  END IF;

  INSERT INTO public.gh_content_rewards AS r (
    post_id, status, enabled, total_earned, author_reward, curation_reward,
    upvote_impact, downvote_impact, net_impact, epoch_key, updated_at,
    finalized_at, distributed_at
  ) VALUES (
    v_id, v_status, COALESCE(p_enabled, false),
    COALESCE(p_total_earned, 0), COALESCE(p_author_reward, 0), COALESCE(p_curation_reward, 0),
    COALESCE(p_upvote_impact, 0), COALESCE(p_downvote_impact, 0), COALESCE(p_net_impact, 0),
    p_epoch_key, now(),
    CASE WHEN v_status IN ('finalized', 'distributed') THEN now() ELSE NULL END,
    CASE WHEN v_status = 'distributed' THEN now() ELSE NULL END
  )
  ON CONFLICT (post_id) DO UPDATE SET
    status = EXCLUDED.status,
    enabled = EXCLUDED.enabled,
    total_earned = EXCLUDED.total_earned,
    author_reward = EXCLUDED.author_reward,
    curation_reward = EXCLUDED.curation_reward,
    upvote_impact = EXCLUDED.upvote_impact,
    downvote_impact = EXCLUDED.downvote_impact,
    net_impact = EXCLUDED.net_impact,
    epoch_key = COALESCE(EXCLUDED.epoch_key, r.epoch_key),
    updated_at = now(),
    finalized_at = CASE
      WHEN EXCLUDED.status IN ('finalized', 'distributed') THEN COALESCE(r.finalized_at, now())
      ELSE r.finalized_at
    END,
    distributed_at = CASE
      WHEN EXCLUDED.status = 'distributed' THEN COALESCE(r.distributed_at, now())
      ELSE r.distributed_at
    END;

  RETURN jsonb_build_object('ok', true, 'postId', v_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_content_reward_system_upsert(
  text, text, boolean, numeric, numeric, numeric, numeric, numeric, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_content_reward_system_upsert(
  text, text, boolean, numeric, numeric, numeric, numeric, numeric, numeric, text
) TO service_role;

-- Optional counts helper used by application (idempotent if already defined elsewhere)
CREATE OR REPLACE FUNCTION public.gh_post_curation_counts(p_post_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := trim(COALESCE(p_post_id, ''));
  v_up bigint := 0;
  v_down bigint := 0;
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ID');
  END IF;
  IF to_regclass('public.gh_post_curations') IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'upvoteCount', 0, 'downvoteCount', 0);
  END IF;
  SELECT
    COUNT(*) FILTER (WHERE choice = 'upvote'),
    COUNT(*) FILTER (WHERE choice = 'downvote')
  INTO v_up, v_down
  FROM public.gh_post_curations
  WHERE post_id = v_id
    AND (deleted_at IS NULL);
  RETURN jsonb_build_object(
    'ok', true,
    'upvoteCount', COALESCE(v_up, 0),
    'downvoteCount', COALESCE(v_down, 0)
  );
EXCEPTION WHEN undefined_column THEN
  SELECT
    COUNT(*) FILTER (WHERE choice = 'upvote'),
    COUNT(*) FILTER (WHERE choice = 'downvote')
  INTO v_up, v_down
  FROM public.gh_post_curations
  WHERE post_id = v_id;
  RETURN jsonb_build_object(
    'ok', true,
    'upvoteCount', COALESCE(v_up, 0),
    'downvoteCount', COALESCE(v_down, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_counts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_counts(text) TO service_role;
