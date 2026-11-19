-- REVIEW-ONLY PROPOSAL — NOT A CANONICAL MIGRATION; DO NOT APPLY AUTOMATICALLY.
-- RUN372/RUN373 read-only Testnet review found that gh_pi_identities and
-- gh_sessions have deny-all RLS policies but retain redundant SELECT grants
-- inherited by anon/authenticated. Server source reads/writes these tables only
-- through server-side service-role access; no browser table access was found.
--
-- This proposal revokes only SELECT from PUBLIC/anon/authenticated. It does not
-- alter RLS policies, table data, sequences, service_role privileges, identity
-- mappings, session records, wallet/economy ledgers, or payment state.
--
-- HOLD until exact Testnet/Mainnet migration history reconciliation, migration
-- generation with `supabase migration new`, disposable PostgreSQL rehearsal,
-- Testnet preflight/postflight, and explicit operator approval. Never paste this
-- proposal directly into a live SQL Editor; promote it through the canonical
-- migration workflow after the historical migration provenance is reconciled.
-- Mainnet must be reviewed and approved separately.

BEGIN;

REVOKE SELECT ON TABLE
  public.gh_pi_identities,
  public.gh_sessions
FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.gh_pi_identities', 'SELECT')
     OR has_table_privilege('authenticated', 'public.gh_pi_identities', 'SELECT')
     OR has_table_privilege('anon', 'public.gh_sessions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.gh_sessions', 'SELECT') THEN
    RAISE EXCEPTION 'client SELECT privilege remains on server-only identity/session tables';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.gh_pi_identities', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.gh_sessions', 'SELECT') THEN
    RAISE EXCEPTION 'service_role SELECT access must remain on identity/session tables';
  END IF;
END;
$$;

COMMIT;
