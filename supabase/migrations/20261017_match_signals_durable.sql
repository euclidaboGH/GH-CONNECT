-- Phase 5 — Match interest signals (like / pass / superlike)
-- Additive. Operator applies after review. Not auto-applied.
-- Match ≠ Friend. Mutual like may create match edge; does not auto-friend.

CREATE TABLE IF NOT EXISTS public.ghc_match_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id text NOT NULL,
  to_user_id text NOT NULL,
  signal text NOT NULL CHECK (signal IN ('like', 'pass', 'superlike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghc_match_signals_no_self CHECK (from_user_id <> to_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ghc_match_signals_pair_uidx
  ON public.ghc_match_signals (from_user_id, to_user_id);

CREATE INDEX IF NOT EXISTS ghc_match_signals_to_like_idx
  ON public.ghc_match_signals (to_user_id, created_at DESC)
  WHERE signal IN ('like', 'superlike');

CREATE INDEX IF NOT EXISTS ghc_match_signals_from_idx
  ON public.ghc_match_signals (from_user_id, created_at DESC);

ALTER TABLE public.ghc_match_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghc_match_signals FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghc_match_signals TO service_role;

-- Upsert signal
CREATE OR REPLACE FUNCTION public.ghc_match_signal_upsert(
  p_from_user_id text,
  p_to_user_id text,
  p_signal text
)
RETURNS public.ghc_match_signals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ghc_match_signals;
BEGIN
  IF p_from_user_id IS NULL OR p_to_user_id IS NULL OR p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'INVALID_PAIR';
  END IF;
  IF p_signal NOT IN ('like', 'pass', 'superlike') THEN
    RAISE EXCEPTION 'INVALID_SIGNAL';
  END IF;

  INSERT INTO public.ghc_match_signals (from_user_id, to_user_id, signal, updated_at)
  VALUES (p_from_user_id, p_to_user_id, p_signal, now())
  ON CONFLICT (from_user_id, to_user_id)
  DO UPDATE SET signal = EXCLUDED.signal, updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_match_signal_upsert(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_match_signal_upsert(text, text, text) TO service_role;
