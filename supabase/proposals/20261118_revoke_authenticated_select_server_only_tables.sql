-- REVIEW_REQUIRED PROPOSAL — do not apply until Testnet migration history and a
-- disposable PostgreSQL rehearsal are complete.
--
-- Live Testnet inspection on 2026-11-18 found these eight tables with RLS enabled,
-- no policies, and redundant authenticated SELECT grants. RLS currently denies
-- row access, and project references are server-side only. This removes the
-- unnecessary client privilege without adding broad RLS policies or changing the
-- existing service_role grants.

BEGIN;

REVOKE SELECT ON TABLE
  public.gh_verification_requests,
  public.ghc_account_flags,
  public.ghc_community_moderation_log,
  public.ghc_community_reports,
  public.ghc_connection_contexts,
  public.ghc_connection_requests,
  public.ghc_match_signals,
  public.ghc_user_blocks
FROM PUBLIC, anon, authenticated;

COMMIT;
