-- Cashback period close reconciliation grace window.
-- REVIEW_REQUIRED: validate function ownership/ACLs and concurrency on disposable PostgreSQL.
-- Do not apply until Testnet/Mainnet migration history has been reconciled.
-- A period is not finalized immediately at its nominal end: delayed provider verification,
-- retries and revenue-journal recovery need time to arrive before the immutable snapshot.

DO $$
BEGIN
  IF to_regprocedure('public.gh_pi_cashback_period_close(text,timestamp with time zone,timestamp with time zone,text)') IS NOT NULL
     AND to_regprocedure('public.gh_pi_cashback_period_close_unchecked(text,timestamp with time zone,timestamp with time zone,text)') IS NULL THEN
    ALTER FUNCTION public.gh_pi_cashback_period_close(text, timestamptz, timestamptz, text)
      RENAME TO gh_pi_cashback_period_close_unchecked;
  END IF;
END;
$$;

-- The original implementation is callable only by its security-definer wrapper, not by API roles.
REVOKE ALL ON FUNCTION public.gh_pi_cashback_period_close_unchecked(text,timestamptz,timestamptz,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gh_pi_cashback_period_close(
  p_period_id text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_policy_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_ends_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PERIOD');
  END IF;

  -- Seven-day reconciliation grace is deliberately separate from the four-month earning window.
  -- The window remains [starts_at, ends_at); this delay only allows late verified events to settle.
  IF now() < p_ends_at + interval '7 days' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'PERIOD_RECONCILIATION_WINDOW_OPEN',
      'reconciliationAvailableAt', p_ends_at + interval '7 days'
    );
  END IF;

  RETURN public.gh_pi_cashback_period_close_unchecked(
    p_period_id, p_starts_at, p_ends_at, p_policy_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_pi_cashback_period_close(text,timestamptz,timestamptz,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_pi_cashback_period_close(text,timestamptz,timestamptz,text)
  TO service_role;

COMMENT ON FUNCTION public.gh_pi_cashback_period_close(text,timestamptz,timestamptz,text) IS
  'Service-role-only four-month Pi cashback close. Enforces a seven-day post-period reconciliation grace before immutable calculation; not a payout.';
