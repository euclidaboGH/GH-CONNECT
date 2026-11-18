-- RUN333 Testnet security reconciliation: remove redundant client SELECT grants
-- from eight RLS-enabled, server-only tables. No policies or service_role grants
-- are changed. Applied and postflight-verified on GH Connect Testnet 2026-11-18.
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
