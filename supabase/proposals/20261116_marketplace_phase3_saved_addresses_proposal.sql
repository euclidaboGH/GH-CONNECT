-- PROPOSAL ONLY — Marketplace Phase 3: owner-only saved delivery addresses.
-- DO NOT APPLY until Testnet/Mainnet migration histories are reconciled independently,
-- this SQL is rehearsed on a disposable PostgreSQL database, and explicit approval is recorded.
-- Hardening Phase 1: addresses are HARD-deleted (no soft-delete retention of name/address/phone) and an
-- erase-user RPC exists for account-deletion / erasure requests (operator hook; not wired automatically).
-- Additive: one new table and five service-role-only RPCs. No existing table, ledger, order,
-- payment or payout object is touched. Personal data: reachable only through the RPCs below,
-- never directly by anon/authenticated clients.

CREATE TABLE IF NOT EXISTS public.gh_marketplace_saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL CHECK (length(trim(user_id)) > 0),
  label text NOT NULL DEFAULT 'Home' CHECK (length(label) BETWEEN 1 AND 40),
  full_name text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 80),
  line1 text NOT NULL CHECK (length(line1) BETWEEN 3 AND 120),
  line2 text NOT NULL DEFAULT '' CHECK (length(line2) <= 120),
  city text NOT NULL CHECK (length(city) BETWEEN 2 AND 60),
  region text NOT NULL DEFAULT '' CHECK (length(region) <= 60),
  postal_code text NOT NULL DEFAULT '' CHECK (length(postal_code) <= 16),
  country text NOT NULL CHECK (length(country) BETWEEN 1 AND 56),
  phone text NOT NULL CHECK (length(phone) BETWEEN 7 AND 24),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_marketplace_saved_addresses_one_default
  ON public.gh_marketplace_saved_addresses (user_id)
  WHERE is_default;
CREATE INDEX IF NOT EXISTS idx_gh_marketplace_saved_addresses_user_active
  ON public.gh_marketplace_saved_addresses (user_id, updated_at DESC);

ALTER TABLE public.gh_marketplace_saved_addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gh_marketplace_saved_addresses FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS gh_marketplace_saved_addresses_no_client ON public.gh_marketplace_saved_addresses;
CREATE POLICY gh_marketplace_saved_addresses_no_client
  ON public.gh_marketplace_saved_addresses
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_marketplace_address_list(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); END IF;
  RETURN jsonb_build_object('ok', true, 'addresses', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'label', a.label, 'fullName', a.full_name, 'line1', a.line1, 'line2', a.line2,
      'city', a.city, 'region', a.region, 'postalCode', a.postal_code, 'country', a.country,
      'phone', a.phone, 'isDefault', a.is_default, 'updatedAt', a.updated_at
    ) ORDER BY a.is_default DESC, a.updated_at DESC)
    FROM public.gh_marketplace_saved_addresses a
    WHERE a.user_id = v_user
  ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_address_save(
  p_user_id text,
  p_address_id uuid,
  p_label text,
  p_full_name text,
  p_line1 text,
  p_line2 text,
  p_city text,
  p_region text,
  p_postal_code text,
  p_country text,
  p_phone text,
  p_make_default boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_count integer;
  v_default boolean := COALESCE(p_make_default, false);
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); END IF;
  IF length(trim(COALESCE(p_full_name, ''))) < 2 OR length(trim(COALESCE(p_line1, ''))) < 3
     OR length(trim(COALESCE(p_city, ''))) < 2 OR length(trim(COALESCE(p_country, ''))) < 1
     OR length(trim(COALESCE(p_phone, ''))) < 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ADDRESS');
  END IF;

  -- Serialise per user so the cap and the single-default rule cannot race.
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_marketplace_saved_addresses:' || v_user, 0));

  SELECT count(*) INTO v_count FROM public.gh_marketplace_saved_addresses
   WHERE user_id = v_user;

  IF p_address_id IS NULL THEN
    IF v_count >= 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'ADDRESS_LIMIT_REACHED'); END IF;
    IF v_count = 0 THEN v_default := true; END IF;
    IF v_default THEN
      UPDATE public.gh_marketplace_saved_addresses SET is_default = false, updated_at = now()
       WHERE user_id = v_user AND is_default;
    END IF;
    INSERT INTO public.gh_marketplace_saved_addresses
      (user_id, label, full_name, line1, line2, city, region, postal_code, country, phone, is_default)
    VALUES
      (v_user, COALESCE(NULLIF(trim(p_label), ''), 'Home'), trim(p_full_name), trim(p_line1), COALESCE(trim(p_line2), ''),
       trim(p_city), COALESCE(trim(p_region), ''), COALESCE(trim(p_postal_code), ''), trim(p_country), trim(p_phone), v_default)
    RETURNING id INTO v_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.gh_marketplace_saved_addresses
                    WHERE id = p_address_id AND user_id = v_user) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ADDRESS_NOT_FOUND');
    END IF;
    IF v_default THEN
      UPDATE public.gh_marketplace_saved_addresses SET is_default = false, updated_at = now()
       WHERE user_id = v_user AND is_default AND id <> p_address_id;
    END IF;
    UPDATE public.gh_marketplace_saved_addresses SET
      label = COALESCE(NULLIF(trim(p_label), ''), label), full_name = trim(p_full_name), line1 = trim(p_line1),
      line2 = COALESCE(trim(p_line2), ''), city = trim(p_city), region = COALESCE(trim(p_region), ''),
      postal_code = COALESCE(trim(p_postal_code), ''), country = trim(p_country), phone = trim(p_phone),
      is_default = CASE WHEN v_default THEN true ELSE is_default END, updated_at = now()
     WHERE id = p_address_id AND user_id = v_user
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_address_set_default(p_user_id text, p_address_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_marketplace_saved_addresses:' || v_user, 0));
  IF NOT EXISTS (SELECT 1 FROM public.gh_marketplace_saved_addresses
                  WHERE id = p_address_id AND user_id = v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ADDRESS_NOT_FOUND');
  END IF;
  UPDATE public.gh_marketplace_saved_addresses SET is_default = false, updated_at = now()
   WHERE user_id = v_user AND is_default AND id <> p_address_id;
  UPDATE public.gh_marketplace_saved_addresses SET is_default = true, updated_at = now()
   WHERE id = p_address_id AND user_id = v_user;
  RETURN jsonb_build_object('ok', true, 'id', p_address_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gh_marketplace_address_delete(p_user_id text, p_address_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_deleted uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_marketplace_saved_addresses:' || v_user, 0));
  -- Hard delete: personal data (name, address, phone) is not retained after the user removes it.
  DELETE FROM public.gh_marketplace_saved_addresses
   WHERE id = p_address_id AND user_id = v_user
  RETURNING id INTO v_deleted;
  IF v_deleted IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'ADDRESS_NOT_FOUND'); END IF;
  -- Keep one default when any address remains: promote the most recently updated.
  IF NOT EXISTS (SELECT 1 FROM public.gh_marketplace_saved_addresses
                  WHERE user_id = v_user AND is_default) THEN
    UPDATE public.gh_marketplace_saved_addresses SET is_default = true, updated_at = now()
     WHERE id = (SELECT id FROM public.gh_marketplace_saved_addresses
                  WHERE user_id = v_user ORDER BY updated_at DESC LIMIT 1);
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', p_address_id);
END;
$$;

-- Erasure hook for account deletion / data-erasure requests. Service-role only; run by an operator
-- process after the deletion review completes (the lifecycle route does not delete automatically).
CREATE OR REPLACE FUNCTION public.gh_marketplace_address_erase_user(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user text := NULLIF(trim(COALESCE(p_user_id, '')), '');
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gh_marketplace_saved_addresses:' || v_user, 0));
  DELETE FROM public.gh_marketplace_saved_addresses WHERE user_id = v_user;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'erased', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.gh_marketplace_address_list(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_marketplace_address_save(text, uuid, text, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_marketplace_address_set_default(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_marketplace_address_delete(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_marketplace_address_erase_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_address_list(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_address_save(text, uuid, text, text, text, text, text, text, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_address_set_default(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_address_delete(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_marketplace_address_erase_user(text) TO service_role;
