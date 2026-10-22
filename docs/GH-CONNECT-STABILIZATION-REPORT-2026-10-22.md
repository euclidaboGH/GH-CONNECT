# GH-CONNECT — Authentication, Payments, Economy, Messaging & Media Stabilization

**Source baseline:** GH-CONNECT 0.70.3 social visibility/profile/curation repair candidate supplied in this conversation.  
**Scope:** source-level stabilization only. No Supabase migration was applied, no production/Testnet record was deleted or modified, and no live Pi payment or payout was executed.

## Changes implemented

### 1. Authentication and session boundaries

- `/api/auth/pi` now enforces the 16 KiB request-body cap against the actual body bytes, including requests without a trustworthy `Content-Length` header.
- Pi access tokens are bounded to 8,192 characters and control characters are rejected with an explicit invalid-format response.
- `/api/payments/approve` now requires an authenticated GH session for any account-bound payment intent in every environment, not only Production. Intent/payment IDs are not treated as bearer credentials.

### 2. Pi payment intent and GHC acquisition binding

- Generic Pi payment intent creation rejects attempts to forge reserved `ghc_pack` metadata; the dedicated server-owned pack-intent endpoint remains the creation path.
- GHC pack fulfillment now requires a completed/fulfilled intent that matches the Pi provider, PI currency, `digital_product` purpose, `ghc_pack` marker, exact product ID, exact GHC amount, provider payment binding, and user-scoped pack reference.
- Generic payment intent creation rejects unsupported currency coercion. GHC is explicitly rejected on the Pi payment rail, including lowercase input.
- Pack acquisition remains feature-gated and depends on the durable, idempotent `ghc_credit_pack_purchase` RPC. These checks do not enable the product or prove a live payment was settled.

### 3. Marketplace listing fee verification

- Listing-fee verification no longer accepts generic `other` payment intents.
- A verified fee intent must use the Pi provider, belong to the seller, be completed, match the server-calculated amount/currency and an approved fee purpose, and be bound to the exact listing.
- If the intent's metadata listing ID and reference-encoded listing ID conflict, verification rejects it. This closes a cross-listing reuse case where either binding channel could previously pass independently.
- A future database-level single-consumption claim is still recommended if the payment-intent metadata model is expanded; the present code enforces consistent intent binding.

### 4. Wallet debits, boosts and utility entitlements

- Client idempotency keys for utility purchases are now length/control-character checked, hashed, and namespaced by user and purpose. A client cannot supply a raw global ledger reference that collides with another operation.
- Post/profile/listing boosts, feed spotlight, community tools and creator-studio purchases are blocked **before any GHC debit** until durable activation records and their consumers are deployed together.
- The utility catalog now returns availability and a clear reason for unavailable features. The UI disables those purchase controls and explains that no GHC will be charged.
- This is an intentional fail-closed safeguard, not a claim that boost ranking or paid tool entitlements are fully implemented. Re-enable each product only after its atomic debit-plus-entitlement pipeline and expiry/reversal behavior pass tests.

### 5. Mission rewards and reward truthfulness

- `/api/economy/missions/progress` no longer treats a client-supplied mission code as proof of an action, consumes activity emission capacity, or reports an unpersisted completion as successful.
- Until durable server-side action verification and a one-time mission claim RPC exist, the route returns an explicit unavailable response and issues no GHC.
- Rewards Centre copy now distinguishes the 48-hour Daily Claim maturity rule from paused mission rewards. Pending GHC remains non-spendable until the server-authoritative claim flow confirms maturity and posting.

### 6. Media upload consistency

- Video size limits now consistently use 40 MiB at the client, proxy upload route and direct-upload intent route, matching the direct-upload completion validator. The storage bucket's 50 MiB cap remains a provider-level ceiling for other supported media categories.
- Updated stale regression assertions to test the actual durable media-ID/ownership contract rather than the removed arbitrary-URL path.

### 7. Source and CI regression quality

- Added `scripts/test-payment-economy-stabilization.mjs` (24 static contract assertions) and wired it into `ci:verify`.
- Corrected stale tests that pinned the package to `0.63.25` despite the checked-in project being `0.70.3`; tests now validate semver and compare release metadata dynamically.
- Updated stale profile-edit and media-attachment tests to validate the current callback and owned-media-reference implementations.
- Documented `GHC_MARKETPLACE_MIN_PLATFORM_FEE_MINOR` in `.env.example` so environment-reference coverage passes.

### 8. Latest GitHub Actions TypeScript failures (commit `aeb1c8a`)

- Added `archived_at: string | null` to the local `PostRow` contract because both canonical visibility queries select `archived_at` and visibility decisions reject archived posts. This is a type-contract correction; it does not add or alter a database column.
- Hardened `app/api/media/[id]/signed-url/route.ts` by validating `ownerId`, `bucket`, and `storagePath` again after the RPC/fallback assignment. The route now uses narrowed local values, requires the storage path to be under the validated owner prefix, rejects traversal/dot/empty path segments, and URL-encodes each path segment. This addresses the reported `string | undefined` errors without weakening media authorization.
- Added `scripts/test-latest-ci-regressions.mjs` (8 assertions) and wired it into `ci:verify` ahead of the full test/typecheck sequence.

## Verification performed

The following targeted source-level checks passed during this pass:

- Latest CI regression checks for the reported `archived_at` and signed-URL narrowing errors: **8/8**.
- New payment/economy stabilization contracts: **24/24**.
- Pi durable payment tests: **54 passed, 0 failed**.
- Critical security hardening: **20 assertions passed**.
- Social authz static scan: **39/39**.
- Social canonical visibility v3: **22/22**.
- Private social/media contracts: **17/17**.
- Social visibility: **14/14**.
- Daily Claim 48-hour lock: **14/14**.
- Daily Claim-only issuance policy: **31/31**.
- Daily claim wallet integrity: **26 passed**; wallet pipeline: **35 passed**.
- Curation reward engine: **24 + 7 checks passed**; Like/curation separation: **12/12**.
- Messaging reliability: **32/32**; comments/replies/messaging: **15/15**.
- Media route hardening: **13/13**; signed URLs: **10/10**; direct upload: **all checks passed**; upload compression: **12/12**.
- Marketplace inventory reservation: **36/36**.
- Phase 5 financial integrity: **11/11**; Phase 6 media/messaging/realtime: **16/16**.
- Phase 7 product experience: **26/26**; Phase 8 architecture: **23/23**; Phase 9 operations: **19/19**; Phase 10 beta gates: **18/18**.
- Deployment network safety: **10/10**; realtime transport hardening: **15/15**.
- Project integrity: **36 checks, 0 errors, 0 warnings**; JSX safety: **729 files scanned**; dependency-lock coverage/root version consistent; project truth: **14/14**; release hygiene: **11/11**.
- Reported build regressions: **7/7**; Vercel build-repair contracts: **9/9**.

These are source/static tests unless explicitly described otherwise; they are not proof of live database, multi-instance, Pi Browser, provider, or payout behavior.

## Release blockers that remain

1. **Duplicate Supabase migration prefixes remain unresolved:**
   - `20261022010091_company_revenue_event_journal.sql` and `20261022010092_gh_post_list_feed_curation_fields.sql`
   - `20261022010093_ghc_credit_pack_purchase.sql` and `20261022010094_pi_payment_intent_idempotency_lookup.sql`

   The migration-history reconciler therefore fails with two local-collision blocks. Do not rename, reorder or apply these files until Testnet and Mainnet migration histories have been captured and compared.

2. The migration release-readiness check identifies 14 migration files with filename dates later than the audit date. Review dependencies and remote histories before applying them.
3. Full `npm run typecheck`, lint and production build were not run after this source patch: the available runtime is Node `v22.16.0`, while `.nvmrc` requires Node `24.15.0`, and `node_modules` is absent. Run clean install and full CI on the pinned runtime.
4. Live Testnet verification is still required for account isolation, duplicate/concurrent payment callbacks, reward maturity boundary behavior, wallet balance reconciliation, listing fee payment binding, message/media visibility, and provider failure recovery.
5. Mission rewards and boosts/paid tools are deliberately fail-closed until their durable verification/activation pipelines exist. Do not present them as live paid features.

## Recommended next sequence

1. Reconcile migration history separately for Testnet and Mainnet; resolve the two duplicate prefixes using reviewed, environment-aware remediation.
2. Install dependencies under Node 24.15.0 and run `npm run ci:verify` in a clean checkout.
3. On Testnet, use two dedicated accounts and run payment/claim concurrency tests, including retries after provider success but before local fulfillment.
4. Implement a durable mission verifier/claim RPC and an atomic boost activation + expiry + ranking-consumption path before re-enabling those UI actions.
5. Capture evidence and reconciliation reports before any stale-record cleanup; never delete ledger, payment, claim or payout evidence as routine cleanup.
