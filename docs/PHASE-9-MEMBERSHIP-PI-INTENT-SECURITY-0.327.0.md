# Phase 9 — Membership Pi intent security (0.327.0)

## Objective

Close a payment-rail ambiguity found while auditing the completed-intent grant and recovery paths. A durable membership payment must explicitly identify the Pi provider, PI currency, membership purpose, non-empty provider payment ID and COMPLETED/FULFILLED state. Missing fields are not inferred from an amount, product metadata or a client request.

## Changes

- Added shared `isVerifiedPiMembershipIntent` policy requiring exact `provider === "pi"`, `currency === "PI"`, `purpose === "membership"`, non-empty `providerPaymentId` and completed/fulfilled status.
- Applied the predicate to direct membership activation and the shared entitlement grant path used by payment completion, fulfillment, recovery and payment-history reconciliation.
- In production database mode, all Pi grants now use the row-locked, idempotent `ghc_membership_renew_from_verified_intent` RPC; a failed/unapplied RPC never falls back to the generic entitlement upsert. The result is re-read and checked against the authenticated user, exact tier, payment intent ID and future expiry before success is reported.
- Direct activation now delegates to the same shared grant workflow as payment callbacks, eliminating a separate Pi entitlement-write path.
- Payment completion and fulfillment endpoints return an explicit retryable `503` when the Pi payment is complete but membership entitlement is not confirmed; they do not return generic success for a membership purchase.
- Payment-history reconciliation now distinguishes “no eligible orphaned purchase” from “a completed membership intent exists but the secure grant is pending/failed”; the latter returns unavailable so the UI cannot claim no orphan was found.
- Audited current premium API consumers: the messaging premium purchase enforces server membership tier before GHC debit. Both the utility endpoint and generic ledger-spend endpoint now fail closed for boost/creator/community utility sinks until a durable effect record and consumer are deployed, preventing a debit without a real premium effect.
- Removed the legacy tier/period metadata fallback: durable membership grants require the exact canonical `metadata.productId` value.
- Forwarded the provider discriminator from every grant caller; payment-history recovery now selects only exact Pi membership intents.
- Added an additive SQL follow-up that uses null-safe `IS DISTINCT FROM` checks for provider and purpose, a coalesced exact currency check, and a required durable `provider_payment_id` before renewal.
- Added runtime matrix tests for missing, mismatched and incomplete intent fields, plus static checks proving the guard is wired into all grant paths.
- Registered the new contracts in `prebuild` and `verify:static`.

## Preserved boundaries

- Existing catalog product ID and exact PI amount checks remain mandatory.
- Completed/fulfilled payment state and durable owner binding remain mandatory.
- GHC membership purchases remain on the atomic GHC spend/entitlement path; this change does not route GHC through Pi.
- No client-side entitlement grant, payment completion, refund, transfer or payout authority was added.
- No auto-renewal or grace access was added.

## Migration

`20261106143001_phase9_membership_pi_renewal_strict_provider_guard.sql` is `REVIEW_REQUIRED`. It replaces the existing service-role-only renewal RPC with the same contract plus null-safe provider/currency/purpose discrimination. It is unapplied and must be checked against the actual target schema/function signature and tested on disposable PostgreSQL before any operator-approved deployment.

## Verification boundary

The strict Pi intent contract passes 12/12 runtime assertions, the Pi grant/activation wiring contract passes 19/19, and the premium membership consumer audit passes 8/8. These checks verify exact intent discriminators, all callback paths, canonical product binding, row-locked database grant, post-write entitlement confirmation, recoverable payment messaging and fail-closed premium utility spending. These are source checks, not a PostgreSQL integration test, live Pi Testnet proof, browser/device acceptance or production approval. The project still requires Node.js 24.15.0 and installed dependencies for TypeScript, ESLint and Next.js build gates.
