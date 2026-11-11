# Phase 3 — Architecture, Identity & Durable Operation Boundaries

**Baseline:** `gh-connect@0.338.13`  
**Generated:** 2026-11-09  
**Status:** Source inventory generated; manual authorization classification, integration tests and live-environment evidence remain open.

## Scope and method

A deterministic dependency-free lexical scanner inventories `app/api/**/route.ts`. It records HTTP methods and textual signals for authentication/privilege helpers, session-grade gates, rate limiting, bounded request bodies, idempotency, request-body identity fields, no-store behavior and webhook/callbacks. It does not parse TypeScript ASTs, prove authorization, inspect runtime control flow, contact Pi/Supabase, or validate remote database state. Missing text is not proof of a defect; present text is not proof every path is protected.

## Inventory totals

| Signal | Routes with signal |
|---|---:|
| routes | 232 |
| authOrPrivilegeHelper | 174 |
| sessionGradeHelper | 1 |
| rateLimitHelper | 115 |
| boundedBodyHelper | 110 |
| idempotencyMarkers | 19 |
| bodyIdentityMarkers | 26 |
| noStoreMarkers | 146 |
| likelySensitiveWithoutMatchingAuth | 15 |
| webhookOrCallbackSignals | 6 |

Full per-route inventory: `docs/PHASE-3-API-ARCHITECTURE-INVENTORY-2026-11-09.csv`.

## Manual review queues

### Sensitive-path routes with no matching auth/privilege-helper token

These are triage candidates only, not confirmed defects. Review handler control flow, middleware, signature validation, public status and privileged-operation behavior before changing code:

- `app/api/auth/logout/route.ts` (POST)
- `app/api/auth/pi/route.ts` (POST)
- `app/api/auth/session/route.ts` (GET)
- `app/api/economy/earnings/platform/route.ts` (GET)
- `app/api/economy/earnings/withdrawals/process/route.ts` (POST)
- `app/api/economy/pi-acquisition-policy/route.ts` (GET)
- `app/api/economy/rewards/pi-cashback/reconcile/route.ts` (GET)
- `app/api/operator/claim-readiness-report/route.ts` (GET)
- `app/api/operator/operational/disputes/route.ts` (POST)
- `app/api/operator/operational/membership-expire/route.ts` (POST)
- `app/api/operator/operational/membership-renew/route.ts` (POST)
- `app/api/operator/operational/payout-corrections/route.ts` (POST)
- `app/api/operator/operational/refunds/route.ts` (POST)
- `app/api/operator/pi-listing-readiness/route.ts` (GET)
- `app/api/payments/a2u/orchestration/route.ts` (GET;POST)

### Routes with request-body identity-like fields

Fields may represent legitimate targets or dangerous caller identity overrides. Confirm actor identity comes from server auth and target identity is independently authorized:

- `app/api/communities/[id]/chat/route.ts`
- `app/api/communities/[id]/requests/route.ts`
- `app/api/communities/[id]/roles/route.ts`
- `app/api/communities/route.ts`
- `app/api/connections/accept/route.ts`
- `app/api/connections/decline/route.ts`
- `app/api/economy/ledger/spend/route.ts`
- `app/api/economy/purchase-ghc/route.ts`
- `app/api/economy/rewards/claim/route.ts`
- `app/api/economy/transfer-requests/route.ts`
- `app/api/economy/transfers/route.ts`
- `app/api/economy/utility/route.ts`
- `app/api/marketplace/listings/route.ts`
- `app/api/marketplace/orders/[orderId]/pay/route.ts`
- `app/api/marketplace/orders/[orderId]/transition/route.ts`
- `app/api/membership/activate/route.ts`
- `app/api/messaging/conversations/[conversationId]/messages/route.ts`
- `app/api/operator/operational/membership-renew/route.ts`
- `app/api/payments/orders/route.ts`
- `app/api/profile/me/route.ts`
- `app/api/social/blocks/route.ts`
- `app/api/social/creator/route.ts`
- `app/api/social/follows/route.ts`
- `app/api/social/posts/[id]/attention/route.ts`
- `app/api/social/posts/[id]/comments/route.ts`
- `app/api/social/tips/route.ts`

## Required architecture invariants

1. **Canonical actor identity:** writes derive the acting GH user from verified session/token mapping, never a caller-supplied actor ID. Target IDs must be separately authorized.
2. **Session-grade actions:** account security, session management, privilege elevation and sensitive recovery require valid "gh_session" and durable session/step-up state where policy demands it. Pi bearer bootstrap alone is not a durable session.
3. **Durable writes:** financial, wallet, membership and marketplace transitions use database-enforced transactions/RPCs or equivalent atomic primitives.
4. **Idempotency:** keys bind to actor and operation payload; mismatched reuse returns a stable conflict.
5. **Fail closed:** unavailable identity mappings, durable session stores, rate-limit controls, ledger snapshots or payment adapters must not silently authorize sensitive writes.
6. **Input/cache/CSRF controls:** bounded schemas, appropriate no-store responses and CSRF protection complement but do not replace authorization.
7. **Environment separation:** source checks do not establish Testnet/Mainnet schema parity, RLS, transaction behavior, Pi API acceptance or deployment configuration.

## Existing source checks executed

- "scripts/check-phase2-architecture-identity-2026-11-04.mjs" — **20/20 PASS**.
- "scripts/check-phase4-identity-authentication.mjs" — **16/16 PASS**.
- "scripts/check-phase2-wallet-authorization.mjs" — **27/27 PASS**.
- "scripts/check-phase2-transfer-request-idempotency-intent.mjs" — **11/11 PASS**.

These are source-contract checks, not full integration/live tests. Runtime used Node "v22.16.0"; the repository baseline pins Node 24, so full verification must be rerun with the approved Node 24 runtime.

## Phase 3 completion gates

- [ ] Manually classify every sensitive-path triage candidate and body identity field.
- [ ] Trace identity from Pi "/v2/me" through "gh_pi_identities" and "gh_sessions" to sensitive route decisions.
- [ ] Test stale/invalid cookie plus bearer fallback, account switching, revoked sessions, multi-instance concurrency and identity-store outages.
- [ ] Exercise idempotent financial writes under duplicate requests, payload mismatch, concurrent races, timeout-after-commit and retry-after-restart.
- [ ] Run typecheck, lint and production verification under Node 24.15.0 (or repository-approved Node 24).
- [ ] Obtain separate read-only Testnet and Mainnet evidence; neither environment is verified by this report.

**Change policy:** this increment adds an auditable source inventory and one narrow route hardening: session revocation now delegates to the existing centralized account-security gate, which enforces durable session storage in production as well as a valid gh_session. Recent step-up, rate limiting, and revocation ordering remain in place. No schema, migration, dependency version, or production setting changed.
