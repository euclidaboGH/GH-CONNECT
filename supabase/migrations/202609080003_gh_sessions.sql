-- Phase 2B: GH CONNECT server sessions
-- Issued only after verified Pi /me + durable identity resolution.
-- Stores token HASH only — never raw session secret, Pi tokens, PINs, or payment secrets.
-- Additive; does not modify economy/ledger/payment tables.

CREATE TABLE IF NOT EXISTS public.gh_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      text NOT NULL,
  gh_user_id      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at      timestamptz,
  user_agent_hash text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_sessions_token_hash_nonempty CHECK (length(trim(token_hash)) > 0),
  CONSTRAINT gh_sessions_user_nonempty CHECK (length(trim(gh_user_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_sessions_token_hash
  ON public.gh_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_gh_sessions_gh_user_id
  ON public.gh_sessions (gh_user_id);

CREATE INDEX IF NOT EXISTS idx_gh_sessions_expires
  ON public.gh_sessions (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.gh_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_sessions_no_client_access ON public.gh_sessions;
CREATE POLICY gh_sessions_no_client_access ON public.gh_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_sessions IS
  'GH CONNECT server sessions. token_hash only. Service-role access. Issued after Pi /me.';
