-- Durable, user-scoped feed feedback. Service-role API is the only writer/reader;
-- feed preference feedback is not a vote and never directly changes rewards.

CREATE TABLE IF NOT EXISTS public.gh_post_curation_feedback (
  user_id text NOT NULL,
  post_id text NOT NULL,
  feedback text NOT NULL CHECK (feedback IN ('show_less', 'show_more', 'hide')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_post_curation_feedback_user_nonempty CHECK (length(trim(user_id)) BETWEEN 1 AND 256),
  CONSTRAINT gh_post_curation_feedback_post_nonempty CHECK (length(trim(post_id)) BETWEEN 1 AND 128),
  CONSTRAINT gh_post_curation_feedback_pk PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_post_curation_feedback_user_updated
  ON public.gh_post_curation_feedback (user_id, updated_at DESC);


-- Transactional outbox foundation for cross-domain integrations. Producers write
-- domain state and its event in the same database transaction; consumers must
-- process idempotently and mark completion only after their side effect commits.
CREATE TABLE IF NOT EXISTS public.gh_domain_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]{2,95}$'),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version BETWEEN 1 AND 1000),
  idempotency_key text NOT NULL UNIQUE CHECK (length(trim(idempotency_key)) BETWEEN 1 AND 256),
  aggregate_type text NOT NULL CHECK (length(trim(aggregate_type)) BETWEEN 1 AND 64),
  aggregate_id text NOT NULL CHECK (length(trim(aggregate_id)) BETWEEN 1 AND 256),
  actor_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  CONSTRAINT gh_domain_event_outbox_actor_nonempty CHECK (actor_id IS NULL OR length(trim(actor_id)) BETWEEN 1 AND 256)
);
CREATE INDEX IF NOT EXISTS idx_gh_domain_event_outbox_pending
  ON public.gh_domain_event_outbox (available_at, created_at)
  WHERE processed_at IS NULL;
ALTER TABLE public.gh_domain_event_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_domain_event_outbox_no_client ON public.gh_domain_event_outbox;
CREATE POLICY gh_domain_event_outbox_no_client ON public.gh_domain_event_outbox
  FOR ALL USING (false) WITH CHECK (false);
COMMENT ON TABLE public.gh_domain_event_outbox IS
  'Server-only transactional outbox for versioned, idempotent cross-domain events. Never a client authority for money or trust.';

ALTER TABLE public.gh_post_curation_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_curation_feedback_no_client ON public.gh_post_curation_feedback;
CREATE POLICY gh_post_curation_feedback_no_client ON public.gh_post_curation_feedback
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_post_curation_feedback IS
  'Durable per-user feed feedback. Does not mutate curation votes, ranking rewards, or wallet balances.';

CREATE OR REPLACE FUNCTION public.gh_post_curation_feedback_set(
  p_user_id text,
  p_post_id text,
  p_feedback text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author text;
  v_deleted timestamptz;
  v_updated_at timestamptz;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) NOT BETWEEN 1 AND 256
     OR p_post_id IS NULL OR length(trim(p_post_id)) NOT BETWEEN 1 AND 128
     OR p_feedback IS NULL OR p_feedback NOT IN ('show_less', 'show_more', 'hide') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT author_id, deleted_at INTO v_author, v_deleted
  FROM public.gh_posts WHERE id::text = trim(p_post_id) LIMIT 1;

  IF v_author IS NULL OR v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_author = trim(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OWN_POST');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ghc_user_blocks b
    WHERE (b.blocker_id = trim(p_user_id) AND b.blocked_id = v_author)
       OR (b.blocker_id = v_author AND b.blocked_id = trim(p_user_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BLOCKED');
  END IF;

  INSERT INTO public.gh_post_curation_feedback (user_id, post_id, feedback, created_at, updated_at)
  VALUES (trim(p_user_id), trim(p_post_id), p_feedback, now(), now())
  ON CONFLICT (user_id, post_id) DO UPDATE
    SET feedback = EXCLUDED.feedback, updated_at = now();

  SELECT updated_at INTO v_updated_at
  FROM public.gh_post_curation_feedback
  WHERE user_id = trim(p_user_id) AND post_id = trim(p_post_id);

  -- Same transaction as the preference write: event delivery can be retried safely.
  INSERT INTO public.gh_domain_event_outbox (
    event_type, schema_version, idempotency_key, aggregate_type, aggregate_id, actor_id, payload
  ) VALUES (
    'curation.feedback_recorded', 1,
    'curation.feedback:' || md5(trim(p_user_id) || ':' || trim(p_post_id) || ':' || p_feedback || ':' || v_updated_at::text),
    'post', trim(p_post_id), trim(p_user_id),
    jsonb_build_object('userId', trim(p_user_id), 'postId', trim(p_post_id), 'feedback', p_feedback, 'updatedAt', v_updated_at)
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'postId', trim(p_post_id), 'feedback', p_feedback);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_post_curation_feedback_list(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) NOT BETWEEN 1 AND 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'postId', f.post_id, 'feedback', f.feedback, 'updatedAt', f.updated_at
  ) ORDER BY f.updated_at DESC), '[]'::jsonb)
  INTO v_items
  FROM public.gh_post_curation_feedback f
  WHERE f.user_id = trim(p_user_id);
  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_feedback_set(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_post_curation_feedback_list(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_feedback_set(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_feedback_list(text) TO service_role;


-- Users can reset their own personalization state through the authenticated API.
CREATE OR REPLACE FUNCTION public.gh_post_curation_feedback_reset(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) NOT BETWEEN 1 AND 256 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_USER');
  END IF;
  DELETE FROM public.gh_post_curation_feedback WHERE user_id = trim(p_user_id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deletedCount', v_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_post_curation_feedback_reset(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_curation_feedback_reset(text) TO service_role;

REVOKE ALL ON TABLE public.gh_domain_event_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.gh_domain_event_outbox TO service_role;
