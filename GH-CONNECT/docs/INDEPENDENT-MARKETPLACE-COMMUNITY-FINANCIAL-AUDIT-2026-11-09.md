# Independent Marketplace, Community & Financial Integrity Audit — 2026-11-09

**Source release:** 0.338.8 (derived from the authoritative 0.338.7 financial-integrity archive)  
**Status:** Source hardening complete for this pass; NOT APPROVED for production.

## Implemented fixes

1. Marketplace order creation moved from process-local rate limiting to the durable, fail-closed user mutation control plane. This prevents horizontally scaled/serverless instances from each granting a separate checkout quota and prevents checkout from silently continuing when the durable limiter is unavailable.
2. Community creation moved to durable fail-closed throttling.
3. Community join and leave use durable fail-closed throttling with separate action buckets.
4. Community role changes use durable fail-closed throttling.
5. Community join-request approval/rejection uses durable fail-closed throttling.
6. Community platform actions (announcements, events, reports, resources and moderation) use durable fail-closed throttling.
7. Community chat mutations use durable fail-closed throttling.
8. Community route identifiers are normalized through the shared bounded community-ID sanitizer on role, request, platform and chat routes.
9. Role target IDs are length-bounded and reject control characters.
10. Join-request applicant IDs are length-bounded and reject control characters.
11. Join-request moderation now requires an explicit JSON boolean for `approve`; missing, string, or malformed decisions no longer default to approval.
12. Saved-listing reads and writes moved to durable fail-closed throttling.
13. Saved-listing RPC transport now has an eight-second timeout so a stalled upstream does not hold route workers indefinitely.
14. New 42-assertion independent regression gate is registered in prebuild and static verification.

## Marketplace — 22 essential controls reviewed

| # | Control | Result |
|---:|---|---|
| 1 | Authenticated listing mutation | PASS |
| 2 | Client seller identity ignored | PASS |
| 3 | Listing mutation durable fail-closed throttle | PASS |
| 4 | Supported GHC/Pi currency boundary | PASS |
| 5 | Currency required for numeric price filters | PASS |
| 6 | Unsupported geo-radius filters fail honestly | PASS |
| 7 | SKU variant/inventory bounds | PASS |
| 8 | Server-owned order creation | PASS |
| 9 | Order creation durable fail-closed throttle | FIXED |
| 10 | Payment mutation durable fail-closed throttle | PASS |
| 11 | Payment bound to authenticated buyer | PASS |
| 12 | Pi payment intent recovery idempotency | PASS |
| 13 | GHC spend uses server authority | PASS |
| 14 | Order transitions participant-scoped | PASS |
| 15 | Buyer confirmation delivery-gated in SQL | PASS |
| 16 | Fulfilment actions participant-scoped | PASS |
| 17 | Shared fulfilment parser | PASS |
| 18 | Order timeline participant-private/no-store | PASS |
| 19 | Production does not use process-memory order authority | PASS |
| 20 | Seller commission calculated server-side | PASS |
| 21 | Saved-listing read/write durable fail-closed throttles | FIXED |
| 22 | Saved-listing RPC bounded timeout | FIXED |

## Communities — 20 essential controls reviewed

| # | Control | Result |
|---:|---|---|
| 1 | Authenticated community creation | PASS |
| 2 | Creator identity bound to session | PASS |
| 3 | Creation durable fail-closed throttle | FIXED |
| 4 | Join durable fail-closed throttle | FIXED |
| 5 | Leave separate durable fail-closed throttle | FIXED |
| 6 | Join/leave authenticated | PASS |
| 7 | Pending/banned membership states distinct | PASS |
| 8 | Role changes authenticated | PASS |
| 9 | Role changes durable fail-closed throttle | FIXED |
| 10 | Community IDs reject controls/excessive length | FIXED |
| 11 | Role target IDs bounded/sanitized | FIXED |
| 12 | Ownership transfer excluded from role API | PASS |
| 13 | Moderation decision requires explicit boolean | FIXED |
| 14 | Moderation decisions durable fail-closed throttle | FIXED |
| 15 | Applicant IDs bounded/sanitized | FIXED |
| 16 | Platform moderation durable fail-closed throttle | FIXED |
| 17 | Platform route uses shared community ID sanitizer | FIXED |
| 18 | Community chat durable fail-closed throttle | FIXED |
| 19 | Chat target user ID bounded/sanitized | FIXED |
| 20 | Community posts viewer-scoped and uncached | PASS |

## Verification performed

- Independent audit gate: **42/42** source assertions passed (22 Marketplace, 20 Communities).
- Marketplace/community static contracts: 36/36 passed; all eight TypeScript-source runtime tests also passed when invoked with the project-required type-stripping flag (44/44 total scripts).
- Additional TypeScript-source runtime tests with Node's experimental type stripping: mapper 16 assertions; currency sorting 3 cases; cart 12 assertions; discovery ranking passed; checkout contracts 16 assertions; fulfilment parser 15 assertions; community discovery 11 assertions; community normalization 18 assertions.
- Financial regression gates: wallet security hardening 11/11; unified earnings ledger 20/20; wallet authorization 27/27; Pi cashback ledger 23/23; payout durable-limit gate passed for 21 route modules; marketplace revenue reconciliation 10/10.
- Marketplace Phase 10 integrity: 30/30; Phase B commerce 9/9; Phase C trust 13/13; Phase D community product 9/9; marketplace resilience 12/12; marketplace domain boundary 14/14.

## Typecheck and runtime limitation

`npm run typecheck` was attempted but its pretypecheck gate correctly stopped because the available Node runtime is `v22.16.0`, while this project pins `^24.15.0`. `npm ci --ignore-scripts --legacy-peer-deps --prefer-offline --no-audit --no-fund` timed out; the dependency tree is incomplete. A global TypeScript compiler attempt failed because the required Node, React and other type definition packages are missing. Therefore **typecheck is BLOCKED, not passed**. Re-run using Node 24.15.0 and a complete `npm ci` before merge/deployment.

## Financial and production acceptance still required

- Validate held `REVIEW_REQUIRED` migrations against disposable PostgreSQL and actual deployed migration history; do not apply from this source-only audit.
- Exercise GHC debit, Pi payment verification, inventory reservation/commit/release, refunds, commission and payout reconciliation under concurrent requests and duplicate callbacks.
- Verify RLS, service-role-only RPC grants, atomic row locking and idempotency on the target Supabase project.
- Reconcile reserved/available balances against ledger entries and provider receipts before any manual release or correction.
- Complete Node 24.15.0 typecheck, lint, full production build, browser/device accessibility and Testnet provider acceptance.
- Mainnet and production payouts remain gated; no live funds or provider state was modified in this audit.
