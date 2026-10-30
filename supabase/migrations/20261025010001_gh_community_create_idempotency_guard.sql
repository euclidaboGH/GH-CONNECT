-- REVIEW_REQUIRED: validate on disposable PostgreSQL and Testnet before applying.
-- Make community creation retries idempotent without allowing an existing community
-- ID to be claimed by a different authenticated user.
CREATE OR REPLACE FUNCTION public.gh_community_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_creator text := COALESCE(p_row->>'createdBy', '');
  v_existing_creator text;
  v_inserted integer := 0;
BEGIN
  IF v_id = '' OR v_creator = '' OR COALESCE(p_row->>'name', '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID');
  END IF;

  INSERT INTO public.gh_communities (
    id, name, purpose, description, category, privacy, created_by,
    cover_image, rules, tags, welcome_message, conversation_id
  ) VALUES (
    v_id,
    p_row->>'name',
    COALESCE(p_row->>'purpose', ''),
    COALESCE(p_row->>'description', ''),
    COALESCE(p_row->>'category', 'general'),
    COALESCE(p_row->>'privacy', 'public'),
    v_creator,
    NULLIF(p_row->>'coverImage', ''),
    COALESCE(p_row->'rules', '[]'::jsonb),
    COALESCE(p_row->'tags', '[]'::jsonb),
    COALESCE(p_row->>'welcomeMessage', ''),
    NULLIF(p_row->>'conversationId', '')
  ) ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    SELECT created_by::text INTO v_existing_creator
      FROM public.gh_communities WHERE id = v_id;
    IF NOT FOUND OR v_existing_creator IS DISTINCT FROM v_creator THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ID_CONFLICT');
    END IF;
    -- Same owner retry: do not rewrite the existing community's content.
    -- The original create and owner membership insert share one transaction.
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'replayed', true);
  END IF;

  INSERT INTO public.gh_community_members (community_id, gh_user_id, role, status)
  VALUES (v_id, v_creator, 'owner', 'active')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_community_create(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_community_create(jsonb) TO service_role;
