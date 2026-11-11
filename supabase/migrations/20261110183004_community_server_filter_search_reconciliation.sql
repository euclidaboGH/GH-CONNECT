-- Run #270: server-authoritative public community search and bounded pagination.
-- Applied to active GH Connect Testnet under generated history version 20261110183004.
-- Adds public-only search indexes and a service_role-only RPC; no membership,
-- privacy, governance or business rows are changed. Mainnet was not accessed.

CREATE INDEX IF NOT EXISTS idx_gh_communities_public_category_created
  ON public.gh_communities (category, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND privacy = 'public';

CREATE INDEX IF NOT EXISTS idx_gh_communities_public_search
  ON public.gh_communities USING gin (
    to_tsvector('simple',
      coalesce(name, '') || ' ' || coalesce(purpose, '') || ' ' ||
      coalesce(description, '') || ' ' || coalesce(tags::text, '')
    )
  ) WHERE deleted_at IS NULL AND privacy = 'public';

CREATE OR REPLACE FUNCTION public.gh_community_search_public(
  p_query text DEFAULT '',
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_query text := left(trim(coalesce(p_query, '')), 160);
  v_category text := nullif(left(trim(coalesce(p_category, '')), 64), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 100000);
  v_has_more boolean := false;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF v_category IS NOT NULL AND (char_length(v_category) > 64 OR v_category ~ '[[:cntrl:]]') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CATEGORY');
  END IF;

  WITH filtered AS (
    SELECT c.id, c.name, c.purpose, c.description, c.category, c.privacy,
      c.created_by AS "createdBy", c.member_count AS "memberCount",
      c.cover_image AS "coverImage", c.tags, c.rules,
      c.welcome_message AS "welcomeMessage", c.conversation_id AS "conversationId",
      (extract(epoch FROM c.created_at) * 1000)::bigint AS "createdAt",
      c.created_at AS sort_created_at
    FROM public.gh_communities c
    WHERE c.deleted_at IS NULL
      AND c.privacy = 'public'
      AND (v_category IS NULL OR c.category = v_category)
      AND (v_query = '' OR to_tsvector('simple',
        coalesce(c.name, '') || ' ' || coalesce(c.purpose, '') || ' ' ||
        coalesce(c.description, '') || ' ' || coalesce(c.tags::text, '')
      ) @@ plainto_tsquery('simple', v_query))
  ), page_raw AS (
    SELECT * FROM filtered
    ORDER BY sort_created_at DESC, id DESC
    LIMIT v_limit + 1 OFFSET v_offset
  ), page AS (
    SELECT page_raw.*, row_number() OVER (ORDER BY sort_created_at DESC, id DESC) AS rn
    FROM page_raw
  )
  SELECT
    coalesce(jsonb_agg(to_jsonb(page) - 'rn' - 'sort_created_at' ORDER BY rn) FILTER (WHERE rn <= v_limit), '[]'::jsonb),
    coalesce(bool_or(rn > v_limit), false)
  INTO v_rows, v_has_more
  FROM page;

  RETURN jsonb_build_object(
    'ok', true,
    'communities', v_rows,
    'pagination', jsonb_build_object(
      'limit', v_limit, 'offset', v_offset, 'returned', jsonb_array_length(v_rows),
      'hasMore', v_has_more, 'filtering', 'server-side'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_community_search_public(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_community_search_public(text, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_search_public(text, text, integer, integer) TO service_role;
