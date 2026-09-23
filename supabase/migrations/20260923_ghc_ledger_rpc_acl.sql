-- GH-CONNECT corrective ACL for ledger foundation RPCs
-- Additive only: privilege hardening for functions created in 20260821_ghc_economy_ledger.sql
-- Does NOT alter function bodies, tables, indexes, RLS policies, or any protected live objects.
--
-- Target functions (exact identities from 20260821):
--   public.ghc_available_balance(text)
--   public.ghc_execute_transfer(text, text, numeric, text, text, text)
--
-- Apply after Group 1 economy foundation (20260821 + 20260822*) and before production smoke tests.

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
