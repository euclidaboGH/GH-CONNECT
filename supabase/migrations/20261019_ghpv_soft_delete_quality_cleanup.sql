-- =============================================================================
-- 20261019_ghpv_soft_delete_quality_cleanup.sql
-- GHPV: when a post is soft-deleted, drop active weights and mark quality open/stale.
--
-- Purpose:
--   Prevent deleted content from contributing to future settlement snapshots.
--   Snapshot already rejects deleted_at IS NOT NULL posts; this cleans residual rows.
--
-- Dependencies:
--   20261016_ghpv_active_weight_set_semantics.sql
--   20261013_ghpv_judgment_infrastructure.sql
--   gh_posts.deleted_at must exist (social schema)
--
-- Objects:
--   gh_ghpv_cleanup_deleted_content(text)
--
-- Security:
--   SECURITY DEFINER, search_path = public
--   REVOKE PUBLIC; GRANT service_role only
--
-- GHC impact: NONE
--
-- Deployment: Testnet after 20261018. Not applied by this repository change.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gh_ghpv_cleanup_deleted_content(
  p_content_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted timestamptz;
BEGIN
  IF p_content_id IS NULL OR length(trim(p_content_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CONTENT_REQUIRED');
  END IF;

  SELECT deleted_at INTO v_deleted
  FROM public.gh_posts
  WHERE id = trim(p_content_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_deleted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_DELETED');
  END IF;

  DELETE FROM public.gh_ghpv_active_weights
  WHERE content_id = trim(p_content_id);

  UPDATE public.gh_content_quality_state
  SET
    upvote_weight = 0,
    downvote_weight = 0,
    independent_voters = 0,
    settlement_status = CASE
      WHEN settlement_status IN ('settled', 'unresolved', 'quarantined') THEN settlement_status
      ELSE 'open'
    END,
    updated_at = now()
  WHERE content_id = trim(p_content_id);

  RETURN jsonb_build_object(
    'ok', true,
    'contentId', trim(p_content_id),
    'cleaned', true,
    'ghcMutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_ghpv_cleanup_deleted_content(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_ghpv_cleanup_deleted_content(text) TO service_role;

COMMENT ON FUNCTION public.gh_ghpv_cleanup_deleted_content(text) IS
  'GHPV: clear active weights for soft-deleted posts. No GHC.';
