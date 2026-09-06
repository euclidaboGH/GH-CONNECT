-- PROMPT #39 — Additive connection request intent durability
-- DO NOT apply automatically. Operator applies after review.
-- Backward compatible: existing relationships without intent remain valid.
-- Does NOT rewrite historical graph edges.

-- ---------------------------------------------------------------------------
-- Connection requests with optional intents (durable, multi-device)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ghc_connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id text NOT NULL,
  to_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  -- JSON array of intent strings, e.g. ["friendship","collaboration"]
  intents jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghc_connection_requests_no_self CHECK (from_user_id <> to_user_id)
);

-- One open pending request per directed pair
CREATE UNIQUE INDEX IF NOT EXISTS ghc_connection_requests_pending_pair_uidx
  ON public.ghc_connection_requests (from_user_id, to_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ghc_connection_requests_to_pending_idx
  ON public.ghc_connection_requests (to_user_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ghc_connection_requests_from_idx
  ON public.ghc_connection_requests (from_user_id, created_at DESC);

-- Optional relationship context retained after accept (not a second graph)
CREATE TABLE IF NOT EXISTS public.ghc_connection_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a text NOT NULL,
  user_b text NOT NULL,
  intents jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  source text,
  request_id uuid REFERENCES public.ghc_connection_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghc_connection_contexts_pair CHECK (user_a < user_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS ghc_connection_contexts_pair_uidx
  ON public.ghc_connection_contexts (user_a, user_b);

ALTER TABLE public.ghc_connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghc_connection_contexts ENABLE ROW LEVEL SECURITY;

-- No broad client write policies — service_role / SECURITY DEFINER RPCs only
REVOKE ALL ON public.ghc_connection_requests FROM PUBLIC;
REVOKE ALL ON public.ghc_connection_contexts FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON public.ghc_connection_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ghc_connection_contexts TO service_role;

-- Upsert pending request with intents (idempotent on pending pair)
CREATE OR REPLACE FUNCTION public.ghc_connection_request_upsert(
  p_from_user_id text,
  p_to_user_id text,
  p_intents jsonb DEFAULT '[]'::jsonb,
  p_note text DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS public.ghc_connection_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_connection_requests;
BEGIN
  IF p_from_user_id IS NULL OR p_to_user_id IS NULL OR p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'INVALID_PAIR';
  END IF;

  INSERT INTO public.ghc_connection_requests (
    from_user_id, to_user_id, status, intents, note, source
  ) VALUES (
    p_from_user_id, p_to_user_id, 'pending',
    COALESCE(p_intents, '[]'::jsonb), p_note, p_source
  )
  ON CONFLICT (from_user_id, to_user_id) WHERE status = 'pending'
  DO UPDATE SET
    intents = COALESCE(EXCLUDED.intents, public.ghc_connection_requests.intents),
    note = COALESCE(EXCLUDED.note, public.ghc_connection_requests.note),
    source = COALESCE(EXCLUDED.source, public.ghc_connection_requests.source),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Accept: mark request accepted and snapshot context (does not invent friendship rows elsewhere)
CREATE OR REPLACE FUNCTION public.ghc_connection_request_accept(
  p_actor_user_id text,
  p_from_user_id text
)
RETURNS public.ghc_connection_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.ghc_connection_requests;
  v_a text;
  v_b text;
BEGIN
  SELECT * INTO v_req
  FROM public.ghc_connection_requests
  WHERE from_user_id = p_from_user_id
    AND to_user_id = p_actor_user_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  UPDATE public.ghc_connection_requests
  SET status = 'accepted', updated_at = now()
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  v_a := LEAST(p_actor_user_id, p_from_user_id);
  v_b := GREATEST(p_actor_user_id, p_from_user_id);

  INSERT INTO public.ghc_connection_contexts (
    user_a, user_b, intents, note, source, request_id
  ) VALUES (
    v_a, v_b, v_req.intents, v_req.note, v_req.source, v_req.id
  )
  ON CONFLICT (user_a, user_b)
  DO UPDATE SET
    intents = EXCLUDED.intents,
    note = EXCLUDED.note,
    source = EXCLUDED.source,
    request_id = EXCLUDED.request_id,
    updated_at = now();

  RETURN v_req;
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_connection_request_decline(
  p_actor_user_id text,
  p_from_user_id text
)
RETURNS public.ghc_connection_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.ghc_connection_requests;
BEGIN
  UPDATE public.ghc_connection_requests
  SET status = 'declined', updated_at = now()
  WHERE from_user_id = p_from_user_id
    AND to_user_id = p_actor_user_id
    AND status = 'pending'
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  RETURN v_req;
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_connection_request_upsert(text, text, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_connection_request_accept(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_connection_request_decline(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ghc_connection_request_upsert(text, text, jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_connection_request_accept(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_connection_request_decline(text, text) TO service_role;

COMMENT ON TABLE public.ghc_connection_requests IS
  'Durable connection requests with optional intents. Not a full social graph replacement.';
COMMENT ON TABLE public.ghc_connection_contexts IS
  'Preserved intent/context after accept. Pair ordered user_a < user_b.';
