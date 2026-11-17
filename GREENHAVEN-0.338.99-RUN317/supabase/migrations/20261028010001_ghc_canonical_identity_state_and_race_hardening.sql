-- Phase 2: canonical identity lifecycle and concurrent ensure hardening.
-- Additive only: existing identities remain active unless explicitly changed by an operator.
ALTER TABLE public.ghc_public_identities
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$ BEGIN
  ALTER TABLE public.ghc_public_identities
    ADD CONSTRAINT ghc_public_identities_status_check
    CHECK (status IN ('active', 'suspended', 'deleted'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ghc_public_identities_active_public_id
  ON public.ghc_public_identities (public_id) WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.ghc_ensure_public_id(
  p_user_id text,
  p_display_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_preferred text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  existing public.ghc_public_identities%ROWTYPE;
  candidate text;
  attempts int := 0;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 OR length(p_user_id) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_USER');
  END IF;
  -- Serialize ensures for the same canonical user to prevent duplicate-create races.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id, 0));
  SELECT * INTO existing FROM public.ghc_public_identities WHERE user_id = p_user_id FOR UPDATE;
  IF FOUND THEN
    IF existing.status <> 'active' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'IDENTITY_INACTIVE');
    END IF;
    IF p_display_name IS NOT NULL OR p_avatar_url IS NOT NULL THEN
      UPDATE public.ghc_public_identities
      SET display_name = COALESCE(left(trim(p_display_name), 120), display_name),
          avatar_url = COALESCE(left(trim(p_avatar_url), 2048), avatar_url),
          updated_at = now()
      WHERE user_id = p_user_id
      RETURNING * INTO existing;
    END IF;
    RETURN jsonb_build_object('ok', true, 'userId', existing.user_id,
      'publicId', existing.public_id, 'displayName', existing.display_name,
      'avatarUrl', existing.avatar_url, 'created', false);
  END IF;

  IF p_preferred IS NOT NULL AND p_preferred ~ '^GH-[A-Z0-9]{6}$'
     AND NOT EXISTS (SELECT 1 FROM public.ghc_public_identities WHERE public_id = p_preferred) THEN
    candidate := p_preferred;
  END IF;
  WHILE candidate IS NULL AND attempts < 24 LOOP
    attempts := attempts + 1;
    candidate := 'GH-' || upper(substr(md5(p_user_id || clock_timestamp()::text || attempts::text), 1, 6));
    IF EXISTS (SELECT 1 FROM public.ghc_public_identities WHERE public_id = candidate) THEN
      candidate := NULL;
    END IF;
  END LOOP;
  IF candidate IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ID_COLLISION');
  END IF;

  BEGIN
    INSERT INTO public.ghc_public_identities (user_id, public_id, display_name, avatar_url, status)
    VALUES (p_user_id, candidate, left(trim(p_display_name), 120), left(trim(p_avatar_url), 2048), 'active')
    RETURNING * INTO existing;
  EXCEPTION WHEN unique_violation THEN
    -- A public-ID collision can still race across different users; fail closed and
    -- let the caller retry rather than returning an identity that was not persisted.
    RETURN jsonb_build_object('ok', false, 'code', 'ID_COLLISION_RETRY');
  END;
  RETURN jsonb_build_object('ok', true, 'userId', existing.user_id,
    'publicId', existing.public_id, 'displayName', existing.display_name,
    'avatarUrl', existing.avatar_url, 'created', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_resolve_public_id(p_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  identity_row public.ghc_public_identities%ROWTYPE;
  normalized text;
BEGIN
  normalized := upper(trim(both FROM coalesce(p_public_id, '')));
  IF left(normalized, 1) = '@' THEN normalized := substr(normalized, 2); END IF;
  IF normalized !~ '^GH-[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ID');
  END IF;
  SELECT * INTO identity_row FROM public.ghc_public_identities
    WHERE public_id = normalized AND status = 'active';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); END IF;
  RETURN jsonb_build_object('ok', true, 'userId', identity_row.user_id,
    'publicId', identity_row.public_id, 'displayName', identity_row.display_name,
    'avatarUrl', identity_row.avatar_url);
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_resolve_public_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_resolve_public_id(text) TO service_role;
