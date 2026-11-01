-- Idempotent fix: gh_pi_wallet_authorization_get hasMapping must reflect identity mapping SELECT,
-- not the subsequent authorization SELECT (FOUND was wrong after the second SELECT).
-- Live databases that already applied this fix are no-ops under CREATE OR REPLACE.
-- Does not change RLS, grants, assert_payout, or table structure.

CREATE OR REPLACE FUNCTION public.gh_pi_wallet_authorization_get(
  p_user_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_row public.gh_pi_wallet_authorizations%ROWTYPE;
  v_map public.gh_pi_identities%ROWTYPE;
BEGIN
  IF v_user IS NULL OR length(v_user) > 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_map FROM public.gh_pi_identities WHERE gh_user_id = v_user LIMIT 1;
  SELECT * INTO v_row FROM public.gh_pi_wallet_authorizations
    WHERE gh_user_id = v_user AND status = 'active'
    ORDER BY consented_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'hasMapping', v_map.gh_user_id IS NOT NULL,
    'mappedPiAppUid', v_map.pi_app_uid,
    'mappedUsername', v_map.pi_username,
    'authorizationActive', v_row.id IS NOT NULL AND v_row.status = 'active',
    'authorizationId', v_row.id,
    'authorizedPiAppUid', v_row.pi_app_uid,
    'consentedAt', v_row.consented_at,
    'lastVerifiedAt', v_row.last_verified_at,
    'uidMatchesAuthorization',
      (v_row.id IS NOT NULL AND v_map.pi_app_uid IS NOT NULL AND v_row.pi_app_uid = v_map.pi_app_uid)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gh_pi_wallet_authorization_get(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_wallet_authorization_get(text) TO service_role;
