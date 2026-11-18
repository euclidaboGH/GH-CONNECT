-- Phase 5: account-owned feed controls. All access is mediated by authenticated
-- server routes using service_role; browser roles have no table/RPC privileges.
CREATE TABLE IF NOT EXISTS public.gh_feed_preferences (
  user_id text PRIMARY KEY,
  preferences jsonb NOT NULL DEFAULT '{"hiddenPostIds":[],"notInterestedPostIds":[],"mutedTopics":[],"filter":"for-you","locationLane":"worldwide","intentionBias":"balanced","focusMode":false}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_feed_preferences_user_nonempty CHECK (length(trim(user_id)) > 0),
  CONSTRAINT gh_feed_preferences_object CHECK (jsonb_typeof(preferences) = 'object'),
  CONSTRAINT gh_feed_preferences_hidden_array CHECK (jsonb_typeof(preferences->'hiddenPostIds') IS NOT DISTINCT FROM 'array'),
  CONSTRAINT gh_feed_preferences_not_interested_array CHECK (jsonb_typeof(preferences->'notInterestedPostIds') IS NOT DISTINCT FROM 'array'),
  CONSTRAINT gh_feed_preferences_muted_topics_array CHECK (jsonb_typeof(preferences->'mutedTopics') IS NOT DISTINCT FROM 'array'),
  CONSTRAINT gh_feed_preferences_hidden_bound CHECK (CASE WHEN jsonb_typeof(preferences->'hiddenPostIds') = 'array' THEN jsonb_array_length(preferences->'hiddenPostIds') <= 200 ELSE false END),
  CONSTRAINT gh_feed_preferences_not_interested_bound CHECK (CASE WHEN jsonb_typeof(preferences->'notInterestedPostIds') = 'array' THEN jsonb_array_length(preferences->'notInterestedPostIds') <= 200 ELSE false END),
  CONSTRAINT gh_feed_preferences_topics_bound CHECK (CASE WHEN jsonb_typeof(preferences->'mutedTopics') = 'array' THEN jsonb_array_length(preferences->'mutedTopics') <= 100 ELSE false END)
);

ALTER TABLE public.gh_feed_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_feed_preferences_no_client ON public.gh_feed_preferences;
CREATE POLICY gh_feed_preferences_no_client ON public.gh_feed_preferences
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_feed_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_feed_preferences TO service_role;

CREATE OR REPLACE FUNCTION public.gh_feed_preferences_get(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_preferences jsonb;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 OR length(p_user_id) > 180 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  SELECT preferences INTO v_preferences
  FROM public.gh_feed_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'exists', false,
      'preferences', '{"hiddenPostIds":[],"notInterestedPostIds":[],"mutedTopics":[],"filter":"for-you","locationLane":"worldwide","intentionBias":"balanced","focusMode":false}'::jsonb
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'exists', true, 'preferences', v_preferences);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_feed_preferences_set(p_user_id text, p_preferences jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 OR length(p_user_id) > 180 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  IF p_preferences IS NULL OR jsonb_typeof(p_preferences) <> 'object'
    OR jsonb_typeof(p_preferences->'hiddenPostIds') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_preferences->'notInterestedPostIds') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_preferences->'mutedTopics') IS DISTINCT FROM 'array'
    OR CASE WHEN jsonb_typeof(p_preferences->'hiddenPostIds') = 'array' THEN jsonb_array_length(p_preferences->'hiddenPostIds') > 200 ELSE false END
    OR CASE WHEN jsonb_typeof(p_preferences->'notInterestedPostIds') = 'array' THEN jsonb_array_length(p_preferences->'notInterestedPostIds') > 200 ELSE false END
    OR CASE WHEN jsonb_typeof(p_preferences->'mutedTopics') = 'array' THEN jsonb_array_length(p_preferences->'mutedTopics') > 100 ELSE false END
    OR COALESCE(p_preferences->>'filter', '') NOT IN ('for-you','following','friends','communities','trending','saved')
    OR COALESCE(p_preferences->>'locationLane', '') NOT IN ('worldwide','city','country')
    OR COALESCE(p_preferences->>'intentionBias', '') NOT IN ('balanced','friendship','professional','dating')
    OR jsonb_typeof(p_preferences->'focusMode') IS DISTINCT FROM 'boolean'
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PREFERENCES');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_preferences->'hiddenPostIds') AS items(value)
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR length(trim(value #>> '{}')) = 0 OR length(value #>> '{}') > 180
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_preferences->'notInterestedPostIds') AS items(value)
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR length(trim(value #>> '{}')) = 0 OR length(value #>> '{}') > 180
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_preferences->'mutedTopics') AS items(value)
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR length(trim(value #>> '{}')) = 0 OR length(value #>> '{}') > 32
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PREFERENCE_ITEMS');
  END IF;

  INSERT INTO public.gh_feed_preferences (user_id, preferences, updated_at)
  VALUES (p_user_id, p_preferences, now())
  ON CONFLICT (user_id) DO UPDATE
    SET preferences = EXCLUDED.preferences, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'durable', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_feed_preferences_get(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_feed_preferences_set(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_feed_preferences_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_feed_preferences_set(text, jsonb) TO service_role;

COMMENT ON TABLE public.gh_feed_preferences IS
  'Account-scoped feed controls and personalization preferences. Client roles are denied; authenticated server routes derive user_id from the session and use service_role.';
COMMENT ON FUNCTION public.gh_feed_preferences_get(text) IS
  'Server-only read of a single account feed preference snapshot; caller must derive user_id from authenticated session.';
COMMENT ON FUNCTION public.gh_feed_preferences_set(text, jsonb) IS
  'Server-only bounded upsert of account feed preferences; caller must derive user_id from authenticated session.';
