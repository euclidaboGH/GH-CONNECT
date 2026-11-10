-- GreenHaven Phase 23 — canonical cross-surface transaction correlation.
-- Metadata is navigational/audit context only; amount/status/source remain authoritative.
CREATE OR REPLACE FUNCTION public.ghc_attach_transaction_correlation(
  p_user_id text,
  p_reference_id text,
  p_correlation jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF coalesce(trim(p_user_id), '') = '' OR coalesce(trim(p_reference_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REFERENCE');
  END IF;
  IF jsonb_typeof(coalesce(p_correlation, '{}'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CORRELATION');
  END IF;
  IF coalesce(p_correlation->>'version', '') <> '1' OR coalesce(trim(p_correlation->>'kind'), '') = '' OR coalesce(trim(p_correlation->>'event'), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_CORRELATION');
  END IF;

  UPDATE public.ghc_transactions
     SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('correlation', p_correlation)
   WHERE user_id = p_user_id
     AND reference_id = p_reference_id
     AND status = 'posted';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.ghc_attach_transaction_correlation(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_attach_transaction_correlation(text, text, jsonb) TO service_role;
COMMENT ON FUNCTION public.ghc_attach_transaction_correlation(text, text, jsonb) IS
  'Service-role-only post-commit correlation metadata enrichment. Does not alter financial fields.';
