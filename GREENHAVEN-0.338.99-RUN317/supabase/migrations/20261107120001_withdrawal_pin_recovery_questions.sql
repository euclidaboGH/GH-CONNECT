-- REVIEW_REQUIRED — Withdrawal PIN recovery via per-user randomized security questions.
-- Stores only scrypt hashes of normalized answers (per-answer salt). No plaintext answers.
-- Additive. Requires 20261105200001_withdrawal_pin_security.sql (gh_withdrawal_pins).
BEGIN;

CREATE TABLE IF NOT EXISTS public.gh_withdrawal_pin_recovery (
  user_id text PRIMARY KEY,
  -- [{ "qid": "birth_city", "salt": "<hex>", "hash": "<hex>" }, ... exactly 3]
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) = 3),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 50),
  locked_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gh_withdrawal_pin_recovery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_withdrawal_pin_recovery_deny_all ON public.gh_withdrawal_pin_recovery;
CREATE POLICY gh_withdrawal_pin_recovery_deny_all ON public.gh_withdrawal_pin_recovery
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.gh_withdrawal_pin_recovery FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gh_withdrawal_pin_recovery TO service_role;

COMMENT ON TABLE public.gh_withdrawal_pin_recovery IS
  'Hashed answers to 3 randomly assigned security questions, used to reset the withdrawal PIN. Server-only.';
COMMIT;
