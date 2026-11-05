-- REVIEW_REQUIRED — GreenHaven withdrawal PIN (app-side security, not Pi passphrase)
-- Stores only a server-side scrypt hash. Never stores plaintext PIN or Pi wallet seeds.
-- Client role has no direct table access.

BEGIN;

CREATE TABLE IF NOT EXISTS public.gh_withdrawal_pins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0 AND failed_attempts <= 50),
  locked_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gh_withdrawal_pins IS
  'App withdrawal PIN hashes only. Separate from login and from Pi wallet keys. Server-side verification only.';

ALTER TABLE public.gh_withdrawal_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_withdrawal_pins_deny_all ON public.gh_withdrawal_pins;
CREATE POLICY gh_withdrawal_pins_deny_all ON public.gh_withdrawal_pins
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.gh_withdrawal_pins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gh_withdrawal_pins TO service_role;

COMMIT;
