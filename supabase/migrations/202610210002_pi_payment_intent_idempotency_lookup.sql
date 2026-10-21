-- Phase 5 hardening: durable idempotency lookup for multi-instance payment creation.
-- Additive only. Does not change existing payment rows or provider state.
CREATE OR REPLACE FUNCTION public.ghc_payment_intent_by_idempotency(
  p_user_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id text;
BEGIN
  IF COALESCE(trim(p_user_id), '') = '' OR COALESCE(trim(p_idempotency_key), '') = '' THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_id
  FROM public.ghc_payment_intents
  WHERE user_id = trim(p_user_id)
    AND idempotency_key = trim(p_idempotency_key)
  LIMIT 1;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.ghc_payment_intent_get(v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.ghc_payment_intent_by_idempotency(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghc_payment_intent_by_idempotency(text,text) TO service_role;
