-- Phase 2A: Durable Pi ↔ GreenHaven identity mapping
-- Source of truth for returning-user / onboarding_completed after Pi /me verification.
-- NEVER store Pi access tokens in this table.
-- Safe: CREATE IF NOT EXISTS only; does not touch economy/ledger tables.

CREATE TABLE IF NOT EXISTS public.gh_pi_identities (
  pi_app_uid              text PRIMARY KEY,
  gh_user_id              text NOT NULL,
  pi_username             text,
  onboarding_completed    boolean NOT NULL DEFAULT false,
  greenhaven_profile_id   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  last_seen_at            timestamptz NOT NULL DEFAULT now(),
  verified_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_pi_identities_pi_app_uid_nonempty CHECK (length(trim(pi_app_uid)) > 0),
  CONSTRAINT gh_pi_identities_gh_user_id_nonempty CHECK (length(trim(gh_user_id)) > 0)
);

-- One GH user maps to at most one current Pi app uid (app-specific uid is the join key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_pi_identities_gh_user_id
  ON public.gh_pi_identities (gh_user_id);

CREATE INDEX IF NOT EXISTS idx_gh_pi_identities_onboarding
  ON public.gh_pi_identities (onboarding_completed);

ALTER TABLE public.gh_pi_identities ENABLE ROW LEVEL SECURITY;

-- No direct client access; service role only (same pattern as economy privileged tables)
DROP POLICY IF EXISTS gh_pi_identities_no_client_access ON public.gh_pi_identities;
CREATE POLICY gh_pi_identities_no_client_access ON public.gh_pi_identities
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_pi_identities IS
  'Verified Pi app uid ↔ GreenHaven user mapping. Tokens never stored. Service-role writes only.';
