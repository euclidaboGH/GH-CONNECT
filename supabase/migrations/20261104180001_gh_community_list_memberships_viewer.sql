-- Phase 3: viewer membership directory for Communities "My" tab.
-- Returns active memberships for a user so the app can mark isMember without
-- inventing rows. Service-role only; called from authenticated API with session user id.

CREATE OR REPLACE FUNCTION public.gh_community_list_memberships(
  p_user_id text,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := nullif(trim(p_user_id), '');
  v_lim integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'USER_REQUIRED', 'memberships', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."joinedAt" DESC NULLS LAST), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      cm.community_id AS "communityId",
      cm.gh_user_id AS "userId",
      cm.role AS role,
      cm.status AS status,
      (extract(epoch from cm.joined_at)*1000)::bigint AS "joinedAt",
      c.name AS name,
      c.member_count AS "memberCount",
      c.privacy AS privacy,
      c.category AS category,
      c.created_by AS "createdBy"
    FROM public.gh_community_members cm
    INNER JOIN public.gh_communities c ON c.id = cm.community_id
    WHERE cm.gh_user_id = v_uid
      AND lower(coalesce(cm.status, 'active')) IN ('active', 'member', 'approved')
      AND c.deleted_at IS NULL
    ORDER BY cm.joined_at DESC NULLS LAST
    LIMIT v_lim
  ) q;

  RETURN jsonb_build_object('ok', true, 'memberships', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_community_list_memberships(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_community_list_memberships(text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_list_memberships(text, integer) TO service_role;
