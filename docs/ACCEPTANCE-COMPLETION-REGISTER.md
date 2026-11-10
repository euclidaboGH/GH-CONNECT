# GreenHaven Acceptance Completion Register

**Baseline:** `0.330.48` (`GREENHAVEN-0.330.48-MAINTAINED-SNAPSHOT.zip`)
**Last updated:** 2026-11-08
**Policy:** A stage is not Verified complete until implementation, automated regression checks, supported-runtime verification, and required integration/runtime acceptance evidence are available. Static source checks alone do not establish production or Testnet readiness.

## Status definitions

- **Not started** — no substantive audit or implementation has been performed.
- **Audited** — current implementation has been inspected and findings recorded; implementation work is not yet complete.
- **Implemented, awaiting verification** — code or configuration changes have been made, but one or more required acceptance checks remain outstanding.
- **Verified complete** — required automated and runtime/integration acceptance evidence has passed and is recorded.

## Live register

| # | Stage | Status | Evidence / remaining acceptance |
|---:|---|---|---|
| 1 | Feed — full reliability and functional acceptance | **Implemented, awaiting verification** | Feed API contract hardening implemented. Static feed completion 32/32; feed product transformation 12/12; deep Phase 1 completion 19/19; engagement reliability 16/16; keyset ordering 9/9; reconciliation static 12/12 and runtime 6/6; Feed Phase 15 12/12; post interactions 12/12; engagement journey 19/19; independent hydration 9/9. Remaining: supported Node 24 dependency install, TypeScript/build, browser/device acceptance, authenticated Supabase integration, pagination/privacy/media/composer end-to-end checks. |
| 2 | Wallet & Payments — financial integrity and security acceptance | **Implemented, awaiting verification** | Audited the durable GHC spend RPC boundary and corrected fail-open success parsing across wallet spend, marketplace GHC payment, and shared durable utility spend. Added strict `ok`, amount, reference, idempotency and transaction-ID validation; 10-second timeouts; no-store requests; retryable 503 handling; then completed a follow-up pass closing 23 wallet/payment gaps plus hidden/offline polling efficiency. Follow-up checks: 23/23; CSV runtime 9/9; spend contract 10/10; wallet security 11/11; authorization 27/27; transfer integrity 8/8; payment body bounds 20/20; RPC timeouts 11/11; wallet product 14/14; wallet completion 12/12; ledger resilience 17/17; reconciliation 32/32; premium home 9/9; asset/history 11/11; withdrawal journey 11/11; release gate 19/19. Remaining: Node 24 dependency install, typecheck/build, DB migration/runtime inspection, authenticated integration, browser/device acceptance, and Pi Testnet payment/settlement verification. |
| 3 | Rewards & Membership — complete earning, redemption and entitlement lifecycle | **Not started** | Audit earning, eligibility, claim, redemption, expiry, renewal, entitlement grant/revoke and ledger reconciliation. |
| 4 | Identity & Authentication — session, account and authorization integrity | **Not started** | Audit Pi authentication, sessions, step-up, WebAuthn, account lifecycle, ownership and authorization boundaries. |
| 5 | Messages & Notifications | **Not started** | Audit durable delivery, unread/read state, deduplication, privacy, retries and notification preferences. |
| 6 | Communities & Discovery — membership, moderation and discovery integration | **Not started** | Audit membership lifecycle, roles, moderation, visibility, ranking and discovery integration. |
| 7 | Marketplace — buyer, seller, orders and payment lifecycle | **Not started** | Audit listing, cart, inventory, order transitions, escrow/payment binding, fulfilment, disputes and refunds. |
| 8 | Profile & Matching — social identity and relationship functionality | **Not started** | Audit profile ownership, privacy, media, follows/blocks, matching eligibility and relationship state. |
| 9 | Settings & Filters — complete persistence and user controls | **Not started** | Audit preference ownership, durable persistence, reset/export behavior, filters and cross-device consistency. |
| 10 | Platform-wide acceptance — performance, accessibility, security and regression | **Not started** | Cross-surface performance budgets, accessibility, security, observability, browser/device and release regression. |

## Phase 1 implementation note

The Feed API now rejects a successful RPC transport that contains an invalid or business-error payload envelope. Previously, a payload with `ok: false` or a missing `posts` array could be normalized into an apparently successful durable empty feed, potentially misleading the UI and terminating pagination. The route now returns `503 FEED_PAYLOAD_INVALID` with `Cache-Control: no-store` for that contract violation.

No database migrations were added, edited, applied, reordered or removed. No wallet, GHC, Pi payment, escrow, payout or production deployment behavior was changed.


## Phase 2 implementation note — 2026-11-08

The wallet/payment audit found a concrete fail-open defect in three durable GHC spend call paths. They treated an HTTP-successful PostgREST response as a successful debit unless the payload explicitly said `ok: false`; a malformed or incomplete payload such as `{}` could therefore be treated as a committed spend. In the marketplace flow this could incorrectly progress order state after no verifiable ledger transaction was returned.

A shared response-contract parser now requires `ok: true`, the exact expected GHC amount (four-decimal precision), the exact idempotency reference, an explicit boolean idempotency result, and a non-empty transaction ID. The wallet spend API, marketplace order payment route, and shared durable utility spend helper all use it. All three durable RPC calls now have a 10-second timeout and bypass HTTP caches. Marketplace ambiguous spend outcomes return retryable HTTP 503 while retaining the payment claim for idempotent recovery; only a definite insufficient-balance result releases the claim, and idempotency conflicts return 409.

No financial rows were rewritten. No migration was added, edited, applied, reordered or removed. No payment provider execution, production deployment, or Testnet transaction was initiated. New source and runtime-independent tests are registered in both `prebuild` and `verify:static`.

### Phase 2 checks executed

- New spend RPC source gate: 10/10.
- New spend RPC payload contract tests: 13/13.
- Existing payment-intent hardening: 11/11.
- Wallet completion: 12/12.
- Wallet transfer integrity: 8/8.
- Pi wallet authorization: 27/27.
- Wallet security hardening: 11/11.
- Wallet ledger resilience: 17/17.
- Payment body bounds: 20/20.
- Wallet amount helpers: 20/20 (executed with Node's TypeScript strip-types mode).
- Cross-feature wallet reconciliation: 32/32.
- Marketplace payment binding: 17/17.
- Marketplace RPC transport: 12/12.
- Withdrawal, payout execution, receipt fencing, treasury, A2U and financial reconciliation source gates passed; see the Phase 2 work report for the full executed list.

These are source/contract checks, not proof of live financial settlement. Phase 2 remains **Implemented, awaiting verification** until supported Node 24 build/typecheck, real Supabase RPC integration, concurrent debit/idempotency tests against the target database, browser/device flows, and Pi Testnet approval/completion/refund/recovery checks are completed.

## Phase 2 follow-up hardening — 2026-11-08

A second wallet/payment hardening pass closed 23 identified gaps across API abuse controls, response caching, RPC error handling, client request deadlines, duplicate refresh prevention, reconciliation validation, claim ambiguity messaging, transfer-history normalization, and secure CSV exports. A further visibility/offline guard reduces unnecessary background wallet polling. The detailed changes and evidence are recorded in `docs/PHASE-2-WALLET-FOLLOWUP-HARDENING-2026-11-08.md`.

Follow-up evidence: wallet hardening 23/23; CSV safety 9/9; GHC spend contract 10/10; wallet security 11/11; wallet authorization 27/27; transfer integrity 8/8; payment body bounds 20/20; economy RPC timeouts 11/11; wallet product transformation 14/14; wallet completion 12/12; wallet ledger resilience 17/17; cross-feature reconciliation 32/32; wallet premium home 9/9; wallet asset/history 11/11; withdrawal journey 11/11; wallet release gate 19/19; changed-file TypeScript syntax transpilation 8/8. Full supported-runtime and live financial acceptance remain outstanding, so Phase 2 remains **Implemented, awaiting verification**.

## Verification environment limitation

The available workspace runtime is Node `22.16.0`; the project explicitly requires Node `^24.15.0` (`.nvmrc` pins `24.15.0`). Dependencies are not installed in this workspace. Therefore a production build, TypeScript check, browser tests, live Supabase integration and Pi Testnet acceptance have not been run here. Do not represent Phase 1 as verified complete until those checks pass.
