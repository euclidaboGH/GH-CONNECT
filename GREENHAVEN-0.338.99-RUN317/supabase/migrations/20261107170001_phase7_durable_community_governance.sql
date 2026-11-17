-- Phase 7 closeout: server-authoritative governance audit writes.
-- Role is rechecked in the same transaction as each moderation append.
-- idx_gh_community_reports_queue from 20261023030001 already covers
-- (community_id, status, created_at DESC); do not create a duplicate.
CREATE INDEX IF NOT EXISTS idx_gh_community_moderation_actor_created
  ON public.gh_community_moderation_log (actor_id, created_at DESC);
ALTER TABLE public.gh_community_moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_community_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_community_moderation_log_no_client ON public.gh_community_moderation_log;
CREATE POLICY gh_community_moderation_log_no_client ON public.gh_community_moderation_log FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS gh_community_reports_no_client ON public.gh_community_reports;
CREATE POLICY gh_community_reports_no_client ON public.gh_community_reports FOR ALL USING (false) WITH CHECK (false);
CREATE OR REPLACE FUNCTION public.gh_community_moderation_log_append(
  p_community_id text, p_actor_id text, p_entry_id text, p_action text,
  p_target_type text, p_target_id text, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text;
BEGIN
  IF coalesce(trim(p_community_id), '') = '' OR coalesce(trim(p_actor_id), '') = ''
     OR coalesce(trim(p_entry_id), '') = '' OR coalesce(trim(p_target_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  IF p_action NOT IN ('pin','unpin','hide','unhide','report','lifecycle','role_change','remove_member','ban_member','unban_member','announcement','event','resource')
     OR p_target_type NOT IN ('post','member','community','report','announcement','event','resource') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;
  v_role := public.gh_community_platform_role(p_community_id, p_actor_id);
  IF v_role NOT IN ('owner','admin','moderator') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  INSERT INTO public.gh_community_moderation_log (id, community_id, actor_id, action, target_type, target_id, metadata)
  VALUES (p_entry_id, p_community_id, p_actor_id, p_action, p_target_type, p_target_id,
    CASE WHEN jsonb_typeof(p_metadata) = 'object' THEN p_metadata ELSE '{}'::jsonb END)
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'durable', true, 'id', p_entry_id);
END;
$$;
REVOKE ALL ON FUNCTION public.gh_community_moderation_log_append(text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_moderation_log_append(text,text,text,text,text,text,jsonb) TO service_role;
REVOKE ALL ON TABLE public.gh_community_moderation_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.gh_community_reports FROM anon, authenticated;
GRANT SELECT ON TABLE public.gh_community_moderation_log TO service_role;
GRANT SELECT ON TABLE public.gh_community_reports TO service_role;
COMMENT ON FUNCTION public.gh_community_moderation_log_append(text,text,text,text,text,text,jsonb)
  IS 'Phase 7 server-only moderation audit append; role is revalidated in the same transaction.';
