# User Programme Phase 3 — Rewards & Membership

Date: 2026-11-08  
Baseline: `GREENHAVEN-0.330.48-PHASE-2-WALLET-RELIABILITY-HARDENED.zip`  
Current implementation: `0.330.49` (Phase 3 closeout hardening)

## Objective

Complete the existing server-authoritative earning, reward claim/redemption, Pi cashback, membership purchase, entitlement, renewal, expiry and recovery lifecycle. Preserve the existing unified ledger and entitlement store; do not create a parallel reward engine or membership authority.

## Source audit

The baseline already includes:

- Unified PI earnings ledger with atomic-unit accounting, pending/available/reserved/paid states, withdrawal quote/reserve/settle/release and reconciliation.
- GHC reward claim and wallet ledger pathways, daily claim idempotency and the 48-hour maturity/lock policy.
- Durable mission evidence and achievement unlocks; generic activity/mission financial issuance remains disabled by policy.
- Separate quarterly PI cashback statement and Testnet-only payout lane.
- Account-isolated, keyset-paginated GHC reward history using the authenticated wallet history endpoint.
- Canonical VIP/VVIP product catalog, server-side GHC and verified-Pi purchase paths, payment-intent recovery, entitlement row validation, lifecycle history, renewal policy, expiry handling and downgrade protection.

This increment deliberately reuses those authorities.

## Defect fixed in this increment

Four authenticated membership API paths performed expensive or privileged work without their own durable request-rate guard:

1. Membership status can query entitlement storage and scan durable completed payment intents for recovery.
2. Membership lifecycle history calls a privileged operational RPC.
3. Membership reconciliation scans payment-intent history and may attempt entitlement recovery.
4. Membership activation can initiate a financial purchase/entitlement flow.

Added per-authenticated-user durable rate limits, configured to fail closed when the durable control plane is unavailable:

- Status: 60 requests / minute.
- Lifecycle history: 60 requests / minute.
- Reconciliation: 10 requests / minute.
- Activation: 8 requests / minute.

The guards run after verified authentication and before database, payment-history or purchase work. Limiter identity is always the server-authenticated user ID, never a client-supplied identity. Rate-limit responses use explicit shared error/status mapping and private no-store headers. No rate-limit response exposes provider or payment details.

Added `scripts/check-phase3-rewards-membership-request-guards.mjs` and registered it in both `prebuild` and `verify:static`.

## Verification performed

Source contracts:

- Rewards entry 18/18.
- Rewards history 20/20.
- Rewards release gate 15/15.
- Verified missions 31/31.
- Rewards + Wallet trust 17/17.
- Deep Rewards transformation 24/24.
- Membership release gate 16/16.
- Strict Pi intent security 19/19.
- Membership consumer audit 8/8.
- Membership experience 23/23.
- Membership transformation 31/31.
- Membership session safety 15/15.
- Membership foundation 18/18.
- New Phase 3 request guard 10/10.

Runtime/pure-contract tests:

- Strict Pi intent matrix 12/12.
- Membership renewal policy 15/15.
- Membership entitlement row parser 14/14.

These are source and isolated policy tests. They do not establish remote migration state, real payment-provider settlement, live database concurrency, browser/device behavior or production readiness.

## Preserved financial and blockchain boundaries

- GHC and PI remain distinct assets, ledgers and settlement rails.
- No client-supplied amount, tier, duration, user ID or payment state becomes authoritative.
- Daily claims remain authenticated, server-computed, idempotent and subject to the maturity policy.
- Missions unlock non-financial achievements only under the current policy; no GHC/PI issuance was enabled.
- Pi cashback remains a separate quarterly PI workflow and Testnet-gated payout lane.
- Membership grants require a canonical product and verified completed payment on the correct rail; the strict Pi grant predicate requires provider `pi`, currency `PI`, purpose `membership`, a non-empty provider payment ID and completed/fulfilled status.
- No automatic renewal, grace-period premium access, VVIP-to-VIP downgrade, client-side minting, transfer, payout, refund or entitlement grant was introduced.
- No database migration was added, applied, reordered or marked remotely applied. No ledger rows or user balances were modified. No live Pi payment or payout was executed.

## Phase 3 closeout hardening — 0.330.49

The follow-up wallet/rewards/membership review identified and repaired these source-level gaps:

1. Reserved Pi earnings now have per-request reason codes and explicit unlock conditions.
2. Self-service release is limited to requests that provably never reached provider execution.
3. Processing and uncertain provider outcomes are never force-released by a user action.
4. A timeout is explicitly not treated as proof of payment failure or loss of earned funds.
5. Successful self-service release writes the exact compensating ledger entry before marking the request released.
6. Reservation recovery is scoped to the authenticated account and Pi Testnet.
7. The wallet now renders human-readable ledger reasons before opaque unique references.
8. The withdrawal request response no longer says execution is disabled after the server has passed its execution-enable gate.
9. GHC membership purchase serializes the complete entitlement preflight/debit/grant transaction per account.
10. Concurrent duplicate same-tier membership purchases cannot charge twice while the tier is active.
11. The database purchase path independently rejects active VVIP-to-VIP downgrade attempts.
12. Reward-claim replay resolves both the original pending-row ID and rewardId metadata alias.
13. Reward-claim retries return the already-posted credit instead of a misleading `NOT_CLAIMABLE` response; a canonical rewardId advisory lock prevents duplicate pending rows with different IDs from being claimed concurrently.
14. Pi payment recovery performs provider lookup before binding a client-supplied payment ID to an intent.
15. Recovery checks the exact provider payment identifier, payer UID, payment direction, network and amount.
16. Recovery requires provider transaction verification and a non-empty txid before marking an intent completed.
17. Cancelled provider payments with conflicting transaction evidence are held for review instead of marked cancelled.
18. Payment recovery now has a durable fail-closed per-account rate limit.
19. Sensitive recovery responses are private and non-cacheable.
20. New source regression checks cover the reservation, reward replay, membership concurrency and Pi recovery boundaries (43/43).

New migration: `20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql` — **REVIEW_REQUIRED, unapplied**. The migration inventory and Testnet apply order were regenerated.

Targeted verification also passed: unified PI earnings ledger 20/20; Phase 3 request guards 10/10; membership lifecycle release gate 16/16; renewal policy 15/15; PI payout execution worker 21/21; payout settlement/recovery 15/15; payout request lifecycle 21/21; wallet withdrawal journey 11/11; wallet security 11/11; cross-feature reconciliation 32/32; migration source manifest 197/197. These are source/pure-policy contracts, not proof of live database concurrency or provider behavior.

## Remaining acceptance gates

1. Reconcile the listed `REVIEW_REQUIRED` membership, earnings and wallet-security migrations with the actual Testnet remote migration history; validate on disposable PostgreSQL before any operator-approved apply.
2. Run Node `24.15.0` with the locked dependencies: clean install, typecheck, lint, safety checks and production build. The current workspace runtime is Node `22.16.0`, so these gates remain unverified here.
3. Run authenticated multi-user Testnet journeys for daily claim, 48-hour maturity, reward redemption, mission evidence, registration bonus reconciliation, PI cashback statement and PI withdrawal.
4. Run GHC and Pi membership purchase, duplicate callback, interrupted entitlement grant recovery, renewal, expiry, refund/reversal and tier downgrade negative tests against the target Testnet database/provider.
5. Test concurrent purchase/claim/recovery requests, account switching, rate-limit exhaustion and durable-control-plane outage behavior. The new source-level locks/idempotency guards are not a substitute for disposable PostgreSQL concurrency evidence.
6. Complete Pi Browser, Android/WebView, keyboard, screen-reader, responsive and performance acceptance.
7. Preserve Mainnet-disabled posture until a separately approved release gate and operator sign-off.

## User programme completion register

| # | Workstream | State | Evidence / next gate |
|---:|---|---|---|
| 1 | Feed — full reliability and functional acceptance | Implemented, awaiting verification | Source work and contracts exist; Node 24, live backend and browser/device acceptance remain. |
| 2 | Wallet & Payments — financial integrity and security acceptance | Implemented, awaiting verification | Source hardening exists; Node 24, Testnet settlement, ledger reconciliation and device acceptance remain. |
| 3 | Rewards & Membership — complete earning, redemption and entitlement lifecycle | Implemented, awaiting verification | Existing lifecycle retained; membership API request guards added; remote DB/provider/runtime acceptance remains. |
| 4 | Identity & Authentication — session, account and authorization integrity | Not started | Await Phase 4. |
| 5 | Messages & Notifications | Not started | Await Phase 5. |
| 6 | Communities & Discovery — membership, moderation and discovery integration | Not started | Await Phase 6. |
| 7 | Marketplace — buyer, seller, orders and payment lifecycle | Not started | Await Phase 7. |
| 8 | Profile & Matching — social identity and relationship functionality | Not started | Await Phase 8. |
| 9 | Settings & Filters — persistence and user controls | Not started | Await Phase 9. |
| 10 | Platform-wide acceptance — performance, accessibility, security and regression | Not started | Await Phase 10. |

The four allowed states are exactly: `Not started`, `Audited`, `Implemented, awaiting verification`, and `Verified complete`. No workstream is marked verified solely from static/source checks.

## Release decision

Phase 3 source hardening is implemented and its targeted source/policy checks pass. The 0.330.49 follow-up adds reservation explanations/release safeguards, concurrent membership purchase serialization, reward claim replay idempotency and verified Pi recovery binding. **Phase 3 remains open as `Implemented, awaiting verification`.** The new migration is REVIEW_REQUIRED and unapplied. Production is not approved.
