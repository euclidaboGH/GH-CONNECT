# Phase 9 — Membership lifecycle and access control (0.326.0)

## Scope

This increment builds on 0.324.0 entitlement parsing and 0.325.0 session integrity. It hardens the current prepaid VIP/VVIP product; it does not introduce recurring billing, refunds, new payment rails, or automatic renewal.

## Premium Membership Home

- Membership status styling and copy now derive only from the authenticated server entitlement response. A local domain cache can no longer color an unavailable or Free server status as active premium.
- The existing premium tier catalog and Free/VIP/VVIP comparison remain the source of plan presentation.
- A read-only membership activity panel shows recent durable lifecycle events (grant, renewal, tier change, expiry, revocation, and payment link) from the authenticated account's server history.
- Lifecycle history has its own cancellable, bounded request and failure state; a history outage never changes the separately fetched entitlement status.
- The UI states that plans are prepaid and do not auto-renew.

## Server-authoritative feature gating

- Added `checkMembershipTierAccess` as a server-only helper backed by `tryGetEntitlementAuthoritative`.
- Store unavailability returns 503; missing/expired/insufficient membership returns 403.
- The messaging premium purchase route now enforces each catalog product's `requiresTier` before any GHC debit. The `business_page_tools` product can no longer rely on a client-side VIP/VVIP check.
- `hasEntitlement` in the browser membership domain is explicitly documented as a presentation hint only. Protected APIs must independently enforce the canonical entitlement.

## Purchase, confirmation and recovery

- Existing GHC purchase remains an atomic spend-plus-entitlement RPC. Existing Pi activation remains bound to the authenticated owner, a durable COMPLETED/FULFILLED Pi intent, exact catalog product and expected server price.
- Existing membership reconciliation remains server-selected and can recover only a completed/fulfilled eligible Pi membership intent; clients cannot submit a chosen tier, amount or proof.
- Purchase success UI remains dependent on a subsequent authoritative entitlement read. Payment receipt alone is not a premium entitlement.
- No client-side payment completion, debit, entitlement grant or refund authority was added.

## Renewal, expiry, grace and cancellation policy

- The operator renewal workflow now loads the durable payment intent, verifies owner, provider, currency, purpose, completion state, exact catalog product and catalog amount before invoking the renewal RPC. The operator request no longer supplies a billing period or duration.
- The new SQL renewal function independently validates the PI provider/currency/purpose, canonical product ID and exact catalog amount, then derives calendar access duration from that product ID, including the published one bonus month. The legacy duration argument is retained only for RPC signature compatibility and is not trusted.
- Renewal is row/advisory-lock serialized and idempotent by payment-intent lifecycle evidence. The immutable entitlement-event trigger records the lifecycle change.
- A 72-hour *continuity-only* window preserves the prior prepaid term boundary when a verified renewal completes shortly after expiry. It does **not** preserve premium access during the gap. The entitlement reader continues to normalize expired access to Free until the verified renewal is committed.
- A bounded operator-only expiry sweep calls the existing service-role expiry RPC. It changes entitlement state and lifecycle history only; it never changes payment, refund or ledger records.
- VIP/VVIP purchases are one-time prepaid terms, not recurring subscriptions. There is no automatic renewal to cancel and no recurring charge schedule. Users simply choose whether to purchase another term. The source does not invent an immediate-cancellation/refund promise; any refund remains subject to the separately governed support/payment policy.
- No grace access is granted after expiry. No auto-renew toggle, cancellation refund or subscription billing system was introduced because no recurring subscription authority exists in the current product.

## Reconciliation and security

- Added an authenticated, read-only lifecycle API scoped to the resolved session user. It returns lifecycle metadata only, not payment amounts or private ledger rows.
- Added an operator-key-protected, bounded expiry sweep endpoint.
- Existing treasury reconciliation remains read-only and separate from entitlement mutation.
- The new migration `20261106123001_phase9_membership_lifecycle_and_renewal_guard.sql` is `REVIEW_REQUIRED`. It has not been applied. Validate function signatures, table dependencies, trigger behavior, ACLs, lock ordering, exact PI price math, idempotency and grace boundaries on disposable PostgreSQL and Testnet before any application.

## Verification

- `scripts/check-phase9-membership-release-gate.mjs`: 14/14 static release checks.
- `scripts/check-phase9-membership-experience.mjs`: 23/23 static contract checks.
- `scripts/test-phase9-membership-renewal-policy.mjs`: 15/15 runtime assertions.
- Existing Phase 9 session-integrity and entitlement-parser checks are retained and registered in `prebuild` and `verify:static`.
- Consolidated `npm run verify:static`: **57/57 passed**; repository consistency 6/6; project truth 10/10; documentation hygiene passed.
- Migration inventory: 188/188 synchronized — 117 REQUIRED, 68 REVIEW_REQUIRED, 1 REQUIRES_APPROVAL and 2 PROPOSAL.
- Full TypeScript, ESLint and Next.js production build were not run: `npm run typecheck`, `npm run lint` and `npm run prebuild` stop at the Node 24.15.x runtime preflight because this workspace has Node 22.16.0; dependencies are not installed.
- Browser/device, real database concurrency, Testnet payment/recovery, operator expiry sweep and reconciliation acceptance remain outstanding.

## Release boundary

Phase 9 remains active. This is a source increment, not production approval. No live database migration was applied, no Pi/GHC transaction was executed, and no Mainnet financial feature was enabled.
