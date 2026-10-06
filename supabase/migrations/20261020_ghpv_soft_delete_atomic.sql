-- =============================================================================
-- 20261020_ghpv_soft_delete_atomic.sql
-- Fold GHPV cleanup into the authoritative post soft-delete RPC.
--
-- Purpose:
--   When the owner soft-deletes a post, clear active GHPV weights in the same
--   transaction. Clients cannot call cleanup for arbitrary content.
--
-- Dependencies:
--   202609230006_gh_social_core.sql (gh_post_soft_delete)
--   20261019_ghpv_soft_delete_quality_cleanup.sql
--
-- Objects:
--   REPLACE public.gh_post_soft_delete(text, text)
--
-- Security:
--   SECURITY DEFINER, search_path = public
--   Actor must equal post author. No client deleted flag.
--   REVOKE PUBLIC; GRANT service_role (same as prior lockdown)
--
-- Idempotency:
--   Second delete on already-deleted post returns ALREADY_DELETED and does not
--   re-open quality state.
--
-- GHC impact: NONE
-- Deployment: Testnet after 20261019. Not applied by this change.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gh_post_soft_delete(p_post_id text, p_actor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_deleted timestamptz;
  v_cleanup jsonb;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0
     OR p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT author_id, deleted_at INTO v_author, v_deleted
  FROM public.gh_posts
  WHERE id = trim(p_post_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author <> trim(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'id', trim(p_post_id), 'alreadyDeleted', true, 'ghcMutated', false);
  END IF;

  UPDATE public.gh_posts
  SET deleted_at = now(), updated_at = now()
  WHERE id = trim(p_post_id) AND deleted_at IS NULL;

  -- Same transaction: drop active weights so settlement snapshot cannot include them.
  v_cleanup := public.gh_ghpv_cleanup_deleted_content(trim(p_post_id));

  RETURN jsonb_build_object(
    'ok', true,
    'id', trim(p_post_id),
    'ghpvCleaned', coalesce((v_cleanup->>'ok')::boolean, false),
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_soft_delete(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_soft_delete(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_post_soft_delete(text, text) IS
  'Owner soft-delete plus GHPV active-weight cleanup. No client deleted flag. No GHC.';
