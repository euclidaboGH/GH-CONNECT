-- Phase 4: Server-side step-up authentication records
-- Bound to GH user + GH session. Short-lived. No credentials stored.
-- Additive; does not modify economy/ledger/payment tables.

CREATE TABLE IF NOT EXISTS public.gh_step_ups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id        text NOT NULL,
  session_id        text NOT NULL,
  auth_method       text NOT NULL DEFAULT 'pi_fresh_auth',
  authenticated_at  timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_step_ups_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_step_ups_session_nonempty CHECK (length(trim(session_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gh_step_ups_user_session
  ON public.gh_step_ups (gh_user_id, session_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gh_step_ups_expires
  ON public.gh_step_ups (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.gh_step_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_step_ups_no_client_access ON public.gh_step_ups;
CREATE POLICY gh_step_ups_no_client_access ON public.gh_step_ups
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_step_ups IS
  'Short-lived step-up assurance after fresh Pi /me. No tokens stored. Service-role only.';
