> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 6 — Cross-feature integration and release reliability

**Release:** v0.95.0  
**Scope:** source-level integration contracts across canonical identity, social/search, curation, wallet/rewards, referrals, payment fulfillment, and messaging.

## What changed

- Added `scripts/check-phase6-integration-reliability.mjs`, a network-free regression gate covering 28 cross-feature contracts. It verifies that existing routes remain connected to the intended canonical identity, authorization, durable ledger, and payment-intent authorities.
- Registered the Phase 6 gate in `npm run verify:static`, so the existing CI/static suite runs it automatically rather than relying on an operator to remember a separate command.
- Synchronized the package, lockfile, in-app release metadata, README, project-truth document, and migration manifest to v0.95.0.
- Added no new database migrations and did not change reward formulas, wallet amounts, payment states, Pi authentication, or Testnet feature flags.

## Integration boundaries checked

- Public identity hydration remains restricted to public profile fields and uncached reads; referral attribution resolves canonical IDs and blocks self-referrals.
- Feed/search identity hydration is integrated; curation remains dependent on persisted server-owned intelligence and strips client authority.
- Wallet reads remain owner-bound and ledger-backed. Claim endpoints derive the user from authentication and defer settlement authority to database RPCs; matured reconciliation requires durable storage.
- Payment fulfillment requires an authenticated intent owner and a durable `COMPLETED` intent, with an explicit idempotent already-fulfilled path.
- Service-role requests remain server-side/no-store, and production session/Pi identity creation refuses memory-only durability.
- Messaging authenticates before resolving the requested conversation and passes the authenticated identity into message-store operations.

## Verification

Run `node scripts/check-phase6-integration-reliability.mjs` or `npm run verify:static`.

This is a **source-contract gate**, not a proof of runtime behavior. It does not call Supabase, Pi, Vercel, or payment providers and does not establish that migrations are applied. Before release, run the supported Node 24 dependency install, TypeScript, lint, and production build, then perform authenticated multi-account Testnet checks for identity, referral, messaging access, curation refresh/vote, wallet/reward concurrency, and payment retries.

## Explicit release status

Not production-approved by this phase alone. Do not bulk-apply migrations or enable Mainnet-sensitive flags based on static checks. Reconcile target migration history first; keep review-required migrations gated until disposable PostgreSQL/Testnet evidence is available.
