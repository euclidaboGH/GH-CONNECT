-- GreenHaven Stories creator upgrade: persist text-story themes and enforce audience filtering.
-- Apply to Testnet first, verify with two accounts, then apply to Mainnet.

ALTER TABLE public.gh_stories
  ADD COLUMN IF NOT EXISTS background text;

CREATE OR REPLACE FUNCTION public.gh_story_create(p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := COALESCE(p_row->>'id', '');
  v_expires timestamptz;
  v_audience text := COALESCE(p_row->>'audience', 'everyone');
BEGIN
  IF v_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID_REQUIRED');
  END IF;
  IF v_audience NOT IN ('everyone', 'followers', 'friends', 'matches-only', 'private') THEN
    v_audience := 'everyone';
  END IF;
  IF p_row ? 'expiresAt' THEN
    v_expires := LEAST(
      to_timestamp((p_row->>'expiresAt')::bigint / 1000.0),
      now() + interval '24 hours'
    );
  ELSE
    v_expires := now() + interval '24 hours';
  END IF;
  IF v_expires <= now() THEN
    v_expires := now() + interval '24 hours';
  END IF;

  INSERT INTO public.gh_stories (
    id, owner_id, owner_name, owner_photo, text, media_type, media_url,
    audience, status, expires_at, created_at, background
  ) VALUES (
    v_id,
    COALESCE(p_row->>'ownerId', ''),
    COALESCE(p_row->>'ownerName', p_row->>'name', ''),
    COALESCE(p_row->>'ownerPhoto', p_row->>'photo', ''),
    COALESCE(p_row->>'text', ''),
    NULLIF(p_row->>'mediaType', ''),
    NULLIF(p_row->>'mediaUrl', ''),
    v_audience,
    'published',
    v_expires,
    CASE WHEN p_row ? 'createdAt'
      THEN to_timestamp((p_row->>'createdAt')::bigint / 1000.0)
      ELSE now() END,
    CASE WHEN length(COALESCE(p_row->>'background', '')) <= 180
      THEN NULLIF(p_row->>'background', '') ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_story_list_active(p_viewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  UPDATE public.gh_stories
    SET status = 'expired'
    WHERE status = 'published' AND expires_at <= now();

  SELECT COALESCE(jsonb_agg(row_to_json(q)::jsonb ORDER BY q."createdAt" DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      s.id,
      s.owner_id AS "ownerId",
      s.owner_name AS name,
      s.owner_photo AS photo,
      s.text,
      s.background,
      CASE WHEN s.media_url IS NOT NULL THEN
        jsonb_build_object('type', COALESCE(s.media_type, 'image'), 'url', s.media_url)
      ELSE NULL END AS media,
      s.audience,
      s.status,
      (extract(epoch from s.created_at)*1000)::bigint AS "createdAt",
      (extract(epoch from s.expires_at)*1000)::bigint AS "expiresAt"
    FROM public.gh_stories s
    WHERE s.status = 'published'
      AND s.expires_at > now()
      AND (
        s.owner_id = p_viewer_id
        OR s.audience = 'everyone'
        OR (
          s.audience = 'followers'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f
            WHERE f.follower_id = p_viewer_id AND f.following_id = s.owner_id
          )
        )
        OR (
          s.audience = 'friends'
          AND EXISTS (
            SELECT 1 FROM public.gh_follows f1
            JOIN public.gh_follows f2
              ON f2.follower_id = f1.following_id
             AND f2.following_id = f1.follower_id
            WHERE f1.follower_id = p_viewer_id
              AND f1.following_id = s.owner_id
          )
        )
        -- matches-only is intentionally owner-only until the canonical match
        -- relation is available in this schema; fail closed rather than leak.
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ghc_user_blocks b
        WHERE (b.blocker_id = p_viewer_id AND b.blocked_id = s.owner_id)
           OR (b.blocker_id = s.owner_id AND b.blocked_id = p_viewer_id)
      )
    ORDER BY s.created_at DESC
    LIMIT 100
  ) q;
  RETURN jsonb_build_object('ok', true, 'stories', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_story_create(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_story_create(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_story_list_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_story_list_active(text) TO service_role;
