# Phase 5 — Business Monetization Pilot

**Status:** source implementation; not deployed; no migration applied; checkout and paid activation remain disabled.

## What this phase adds

- A server-owned, read-only catalog for four business offers: Business Profile Plus, Promoted Listing, Promoted Post, and Business Insights.
- `GET /api/business/monetization` returns the current pilot-preparation policy, explicit non-purchasable status, disclosures and release gates.
- Prices are intentionally unset (`priceMinor: null`) pending written product/finance approval. No pricing, revenue, entitlement or settlement is fabricated.
- The endpoint is public and read-only, uses a short bounded cache, and exposes no account-specific or operational secrets.
- Regression tests enforce the default-off payment and entitlement boundary and join `ci:verify`.

## Architecture and financial boundaries

- This is an offer/catalog foundation, not a checkout integration.
- No payment provider is called, no payment intent is created, no business entitlement is granted, and no company revenue is recorded.
- GHC utility balances are not payment-provider settlement evidence. Existing GHC ledger, seller proceeds, Pi payment intents and company revenue journal remain separate authorities.
- Promotion is not a promise of reach or sales. Future sponsored placement must be labelled, moderated, and governed by eligibility and abuse controls.
- Business ownership and role authorization must be checked server-side for every future mutation; never trust a browser-supplied business ID or payment status.

## Required before paid pilot

1. Product and finance approve offer details, prices, currency, tax handling, duration, renewal, refund/cancellation policy and customer disclosures.
2. Implement provider-specific server-side payment verification, idempotency and replay protection.
3. Record revenue atomically at the verified settlement source or via a durable transactional outbox; reconcile gross, fees, tax, refunds and chargebacks.
4. Add durable entitlement tables/RPCs with ownership checks, RLS/grants, expiry, renewal, revocation and audit history. Test migrations on disposable PostgreSQL first.
5. Add moderation, sponsorship labelling, frequency caps, abuse/fraud checks, analytics privacy limits and support/refund operations.
6. Run supported Node install, TypeScript, lint, production build, complete CI, SQL concurrency/security tests and two-account Testnet/Pi Browser verification.
7. Obtain product, finance, legal and release approval before enabling a live payment path.

## Validation

Run `node scripts/test-phase5-business-monetization.mjs` for source-level checks. These checks do not prove production readiness or live payment behavior.
