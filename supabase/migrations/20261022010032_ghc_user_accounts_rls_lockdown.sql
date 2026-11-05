-- Additive security hardening: ghc_user_accounts must not be broadly readable via PostgREST.
-- Prior policy ghc_user_accounts_select_own used USING (true), exposing all rows.
-- Align with other authority tables: deny client access; service-role / SECURITY DEFINER RPCs only.

DROP POLICY IF EXISTS ghc_user_accounts_select_own ON public.ghc_user_accounts;

-- Explicit deny for anon/authenticated clients on all operations.
-- Service role bypasses RLS; RPCs that need reads run as SECURITY DEFINER.
DROP POLICY IF EXISTS ghc_user_accounts_deny_client_all ON public.ghc_user_accounts;
CREATE POLICY ghc_user_accounts_deny_client_all
  ON public.ghc_user_accounts
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.ghc_user_accounts IS
  'Internal account anchor. Client access denied via RLS; mutations via service-role RPCs only.';
