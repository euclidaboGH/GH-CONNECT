-- Pass 45: bounded retention for durable abuse-control state.
-- Additive only: preserve the existing service-role-only control-plane contract.

CREATE INDEX IF NOT EXISTS idx_gh_security_rate_limit_updated_at
  ON public.gh_security_rate_limit_buckets(updated_at);

-- Expired security events are removed in bounded batches by the rate-limit RPC.
-- New events receive a 90-day expiry in the server adapter; legacy NULL-expiry
-- rows are intentionally preserved for operator review rather than guessed away.
CREATE OR REPLACE FUNCTION public.gh_security_rate_limit_consume(
  p_bucket_key text,
  p_limit integer,
  p_window_ms bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := left(trim(coalesce(p_bucket_key,'')), 200);
  v_limit integer := greatest(1, least(coalesce(p_limit,1), 100000));
  v_window bigint := greatest(1000, least(coalesce(p_window_ms,60000), 86400000));
  v_now timestamptz := clock_timestamp();
  v_row public.gh_security_rate_limit_buckets%ROWTYPE;
  v_elapsed bigint;
  v_count integer;
BEGIN
  IF v_key = '' THEN RETURN jsonb_build_object('ok',false,'error','INVALID_BUCKET'); END IF;

  -- Sample cleanup at approximately 1/256 of distinct hashed bucket keys.
  -- Each DELETE is capped at 500 rows, avoiding an unbounded request transaction.
  IF mod(abs(hashtext(v_key)::bigint), 256) = 0 THEN
    WITH stale AS (
      SELECT ctid FROM public.gh_security_rate_limit_buckets
      WHERE updated_at < v_now - interval '2 days'
      ORDER BY updated_at
      LIMIT 500
    )
    DELETE FROM public.gh_security_rate_limit_buckets b
    USING stale WHERE b.ctid = stale.ctid;

    WITH expired AS (
      SELECT ctid FROM public.gh_security_events
      WHERE expires_at IS NOT NULL AND expires_at <= v_now
      ORDER BY expires_at
      LIMIT 500
    )
    DELETE FROM public.gh_security_events e
    USING expired WHERE e.ctid = expired.ctid;
  END IF;

  INSERT INTO public.gh_security_rate_limit_buckets(bucket_key,window_started_at,window_ms,hit_count,updated_at)
  VALUES(v_key,v_now,v_window,1,v_now)
  ON CONFLICT(bucket_key) DO UPDATE SET
    window_started_at = CASE
      WHEN extract(epoch FROM (v_now - gh_security_rate_limit_buckets.window_started_at))*1000 >= gh_security_rate_limit_buckets.window_ms
      THEN v_now ELSE gh_security_rate_limit_buckets.window_started_at END,
    window_ms = v_window,
    hit_count = CASE
      WHEN extract(epoch FROM (v_now - gh_security_rate_limit_buckets.window_started_at))*1000 >= gh_security_rate_limit_buckets.window_ms
      THEN 1 ELSE gh_security_rate_limit_buckets.hit_count + 1 END,
    updated_at = v_now
  RETURNING * INTO v_row;

  v_count := v_row.hit_count;
  v_elapsed := greatest(0, v_row.window_ms - floor(extract(epoch FROM (v_now - v_row.window_started_at))*1000)::bigint);
  RETURN jsonb_build_object(
    'ok', v_count <= v_limit,
    'remaining', greatest(0,v_limit-v_count),
    'retryAfterSec', greatest(1,ceil(v_elapsed/1000.0)),
    'count',v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gh_security_rate_limit_consume(text,integer,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_security_rate_limit_consume(text,integer,bigint) TO service_role;

COMMENT ON INDEX public.idx_gh_security_rate_limit_updated_at IS 'Supports bounded cleanup of expired durable rate-limit buckets.';
