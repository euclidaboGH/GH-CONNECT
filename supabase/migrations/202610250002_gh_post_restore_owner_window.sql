-- 202610250002_gh_post_restore_owner_window.sql
-- Owner-only recovery for soft-deleted posts. Visibility restoration is not
-- economic settlement: GHPV weights, rewards, and GHC balances are untouched.
-- Apply only after verifying migration history on the target Supabase project.

CREATE OR REPLACE FUNCTION public.gh_post_restore(p_post_id text, p_actor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_deleted timestamptz;
BEGIN
  IF p_post_id IS NULL OR length(trim(p_post_id)) = 0
     OR p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT author_id, deleted_at
    INTO v_author, v_deleted
    FROM public.gh_posts
   WHERE id = trim(p_post_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author IS DISTINCT FROM trim(p_actor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_deleted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_DELETED');
  END IF;
  IF v_deleted < now() - interval '30 days' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RESTORE_WINDOW_EXPIRED');
  END IF;

  UPDATE public.gh_posts
     SET deleted_at = NULL, updated_at = now()
   WHERE id = trim(p_post_id) AND deleted_at IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'id', trim(p_post_id),
    'restored', true,
    'ghcMutated', false,
    'curationWeightsRestored', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_restore(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_post_restore(text, text) TO service_role;

COMMENT ON FUNCTION public.gh_post_restore(text, text) IS
  'Owner-only soft-deleted post recovery within 30 days. Does not restore GHPV weights or mutate GHC.';
