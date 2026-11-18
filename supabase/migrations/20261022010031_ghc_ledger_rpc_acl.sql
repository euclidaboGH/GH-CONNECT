-- GH-CONNECT corrective ACL for ledger foundation RPCs
-- Additive only: privilege hardening for functions created in 20261022010001_ghc_economy_ledger.sql
-- Does NOT alter function bodies, tables, indexes, RLS policies, or any protected live objects.
--
-- Target function identities are established by the canonical repository
-- foundation 20261022010001_ghc_economy_ledger.sql. Later CREATE OR REPLACE
-- updates preserve the function ACL; this migration intentionally precedes them.
--   public.ghc_available_balance(text)
--   public.ghc_execute_transfer(text, text, numeric, text, text, text)
--
-- Apply after 20261022010001_ghc_economy_ledger.sql and before production
-- smoke tests. Historical 20260821 / 20260822 references are not required
-- inputs to this canonical migration set.

-- ---------------------------------------------------------------------------
-- ghc_available_balance(text)
-- LANGUAGE sql STABLE (invoker rights; not SECURITY DEFINER).
-- Default PostgreSQL privilege is EXECUTE for PUBLIC; harden to service_role only.
-- Internal callers (ghc_execute_transfer / ghc_execute_spend bodies) run as function
-- owner and do not depend on PUBLIC EXECUTE.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ghc_available_balance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_available_balance(text) TO service_role;

-- ---------------------------------------------------------------------------
-- ghc_execute_transfer(text, text, numeric, text, text, text)
-- SECURITY DEFINER SET search_path = public.
-- 20260821 already REVOKEs PUBLIC but never GRANTs service_role; server path
-- (lib/server/economy/db.ts → rpcExecuteTransfer) requires service_role EXECUTE.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ghc_execute_transfer(text, text, numeric, text, text, text) TO service_role;
