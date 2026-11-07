# Upgrade worklog — GH-CONNECT 0.327.0

## Phase 9 Membership payment-rail integrity

Audited the canonical completed-payment membership grant paths and found that the shared grant helper accepted a missing currency and did not require the explicit Pi provider discriminator; the direct activation route had the same optional-currency pattern. Hardened these paths to require the exact durable Pi provider, PI currency, membership purpose, non-empty provider payment ID and COMPLETED/FULFILLED status. Payment-history reconciliation now selects only exact Pi membership intents. All payment completion, fulfill and recovery callers now forward the stored provider.

Added an additive SQL follow-up using null-safe provider/currency/purpose checks plus a required durable provider payment ID in the service-role-only renewal RPC. Unified production Pi membership grant, completion, fulfillment, recovery and activation around that row-locked idempotent RPC; no production DB-mode fallback to the generic upsert remains. Each grant is re-read and verified against user, tier, payment-intent ID and future expiry before success. Canonical `metadata.productId` is mandatory; legacy tier/period metadata no longer substitutes for it. Payment completion/fulfillment now returns an explicit retryable 503 when a membership payment is complete but its entitlement is pending. Recovery no longer reports “no orphaned purchase” when a durable completed membership intent exists but the secure grant failed. Audited premium API consumers and closed a second spend path: the generic GHC ledger-spend route now blocks boosts and premium tool sinks before debit until durable effect activation exists, matching the existing utility-route fail-closed behavior. The migration is REVIEW_REQUIRED and unapplied. Added 10 runtime policy assertions and 10 static wiring/security assertions, registered in both `prebuild` and `verify:static`.

## Validation

- Pi intent policy runtime: 12/12 passed.
- Pi intent wiring/security: 19/19 passed.
- Membership consumer audit: 8/8 passed.
- Broader static and repository checks are run for this release where the current Node runtime permits.
- Node runtime is currently 22.16.0; the project requires Node.js 24.15.0. Dependency-backed TypeScript, ESLint and Next.js production build are not certified in this environment.
- No database migration was applied, no Pi/GHC payment was executed, and no Mainnet feature was enabled.

GHC and Pi remain separate rails and ledgers. Prepaid plans do not auto-renew (no-auto-renew); no recurring billing or grace access is introduced.

## Release status

Production approval remains pending. Phase 9 remains active. This increment closes a specific source-level Pi intent ambiguity; it does not claim complete Membership production acceptance. Remaining gates include disposable PostgreSQL migration/concurrency validation, Testnet purchase/recovery/renewal tests, protected feature consumer audit, browser/device acceptance, Node 24 build gates and operator sign-off.
