-- REVIEW-ONLY PROPOSAL — NOT A CANONICAL MIGRATION; DO NOT APPLY AUTOMATICALLY.
-- RUN352 read-only Testnet audit found client SELECT grants on these server-only
-- financial tables. Each table currently has an RLS deny-all policy for client roles,
-- and source review found no direct browser/client table reads. Server routes use
-- service-role REST/RPC access. This proposal removes redundant client SELECT grants
-- while preserving every existing service_role privilege and all RLS policies.
-- Reconcile target migration history and rehearse on disposable PostgreSQL/Testnet first.
-- Mainnet requires separate explicit user approval and must not be changed by this file.

BEGIN;

REVOKE SELECT ON TABLE
  public.gh_marketplace_orders,
  public.gh_marketplace_order_proceeds,
  public.gh_marketplace_order_adjustments,
  public.ghc_membership_entitlements,
  public.ghc_payment_intents,
  public.ghc_withdrawal_requests
FROM PUBLIC, anon, authenticated;

COMMIT;
