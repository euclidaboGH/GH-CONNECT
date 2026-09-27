-- Phase D5: server-authoritative GreenHaven public IDs
-- Safe public receive identity (not email/phone/token/internal-only UUID)

CREATE TABLE IF NOT EXISTS public.ghc_public_identities (
  user_id       text PRIMARY KEY,
  public_id     text NOT NULL,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghc_public_id_format CHECK (public_id ~ '^GH-[A-Z0-9]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_public_identities_public_id
  ON public.ghc_public_identities (public_id);

CREATE INDEX IF NOT EXISTS idx_ghc_public_identities_public_id
  ON public.ghc_public_identities (public_id);

ALTER TABLE public.ghc_public_identities ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read public identity rows (no email/phone/balance)
DROP POLICY IF EXISTS ghc_public_identities_select ON public.ghc_public_identities;
CREATE POLICY ghc_public_identities_select ON public.ghc_public_identities
  FOR SELECT
  USING (true);

-- Writes only via service role / RPC (no direct client insert/update)
DROP POLICY IF EXISTS ghc_public_identities_no_client_write ON public.ghc_public_identities;
CREATE POLICY ghc_public_identities_no_client_write ON public.ghc_public_identities
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Ensure public id for a user (service-role / security definer)
CREATE OR REPLACE FUNCTION public.ghc_ensure_public_id(
  p_user_id text,
  p_display_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_preferred text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.ghc_public_identities%ROWTYPE;
  candidate text;
  attempts int := 0;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_USER');
  END IF;

  SELECT * INTO existing FROM public.ghc_public_identities WHERE user_id = p_user_id;
  IF FOUND THEN
    IF p_display_name IS NOT NULL OR p_avatar_url IS NOT NULL THEN
      UPDATE public.ghc_public_identities
      SET
        display_name = COALESCE(p_display_name, display_name),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = now()
      WHERE user_id = p_user_id
      RETURNING * INTO existing;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'userId', existing.user_id,
      'publicId', existing.public_id,
      'displayName', existing.display_name,
      'avatarUrl', existing.avatar_url,
      'created', false
    );
  END IF;

  -- Prefer client-compatible preferred ID when unique and well-formed
  IF p_preferred IS NOT NULL AND p_preferred ~ '^GH-[A-Z0-9]{6}$' THEN
    IF NOT EXISTS (SELECT 1 FROM public.ghc_public_identities WHERE public_id = p_preferred) THEN
      candidate := p_preferred;
    END IF;
  END IF;

  WHILE candidate IS NULL AND attempts < 12 LOOP
    attempts := attempts + 1;
    candidate := 'GH-' || upper(substr(md5(p_user_id || clock_timestamp()::text || attempts::text), 1, 6));
    IF EXISTS (SELECT 1 FROM public.ghc_public_identities WHERE public_id = candidate) THEN
      candidate := NULL;
    END IF;
  END LOOP;

  IF candidate IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ID_COLLISION');
  END IF;

  INSERT INTO public.ghc_public_identities (user_id, public_id, display_name, avatar_url)
  VALUES (p_user_id, candidate, p_display_name, p_avatar_url)
  RETURNING * INTO existing;

  RETURN jsonb_build_object(
    'ok', true,
    'userId', existing.user_id,
    'publicId', existing.public_id,
    'displayName', existing.display_name,
    'avatarUrl', existing.avatar_url,
    'created', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ghc_resolve_public_id(p_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.ghc_public_identities%ROWTYPE;
  normalized text;
BEGIN
  normalized := upper(trim(both FROM coalesce(p_public_id, '')));
  IF left(normalized, 1) = '@' THEN
    normalized := substr(normalized, 2);
  END IF;
  IF normalized !~ '^GH-[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ID');
  END IF;

  SELECT * INTO row FROM public.ghc_public_identities WHERE public_id = normalized;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  -- Minimum public projection only
  RETURN jsonb_build_object(
    'ok', true,
    'userId', row.user_id,
    'publicId', row.public_id,
    'displayName', row.display_name,
    'avatarUrl', row.avatar_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ghc_resolve_public_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_ensure_public_id(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ghc_resolve_public_id(text) TO service_role;
