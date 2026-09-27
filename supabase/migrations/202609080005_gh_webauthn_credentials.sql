-- Phase 7: WebAuthn / Passkey public credential metadata only.
-- NEVER stores private keys, biometrics, PINs, or session tokens.
-- Additive; RLS denies client direct access.

CREATE TABLE IF NOT EXISTS public.gh_webauthn_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id      text NOT NULL,
  credential_id   text NOT NULL,
  public_key      text NOT NULL,
  counter         bigint NOT NULL DEFAULT 0,
  transports      text[] NOT NULL DEFAULT '{}',
  device_type     text,
  backed_up       boolean NOT NULL DEFAULT false,
  label           text NOT NULL DEFAULT 'Passkey',
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  CONSTRAINT gh_webauthn_cred_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_webauthn_cred_id_nonempty CHECK (length(trim(credential_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_webauthn_credential_id
  ON public.gh_webauthn_credentials (credential_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gh_webauthn_user
  ON public.gh_webauthn_credentials (gh_user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gh_webauthn_challenges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id      text NOT NULL,
  session_id      text,
  challenge       text NOT NULL,
  purpose         text NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_webauthn_challenges_user
  ON public.gh_webauthn_challenges (gh_user_id, purpose)
  WHERE used_at IS NULL;

ALTER TABLE public.gh_webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_webauthn_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_webauthn_cred_no_client ON public.gh_webauthn_credentials;
CREATE POLICY gh_webauthn_cred_no_client ON public.gh_webauthn_credentials
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_webauthn_chal_no_client ON public.gh_webauthn_challenges;
CREATE POLICY gh_webauthn_chal_no_client ON public.gh_webauthn_challenges
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_webauthn_credentials IS
  'WebAuthn public credentials only. Service-role access. No private keys.';
