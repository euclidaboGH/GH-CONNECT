# Phase 3 — Rewards & Membership continuation

**Baseline:** `GREENHAVEN-PHASE2-SOCIAL-ENGAGEMENT-2026-11-14.zip` (derived from authoritative `0.338.67` archive)
**Work date:** 14 November 2026
**Scope:** Priority 3 Rewards and its boundary with Priority 4 Membership. This is a source-level continuation, not a declaration that historical Phase 3 work or external acceptance is complete.

## Surgical defect fixed

The Rewards Centre hydrated durable achievement rows into component state, but the rows had no explicit owner identity. On an account switch, React can render once with the new `userId` before the account-change effect clears old state. During that render, an achievement unlocked by the previous account could be presented as completed for the new account.

The component now binds hydrated achievement rows to the exact account that produced the successful response:

- The owner reference is cleared before each hydration begins.
- Achievement rows are considered only when the stored owner matches the active authenticated account.
- Ownership is assigned only after a successful response.
- Failed hydration clears the owner and rows.
- The existing rule remains: local challenge progress is guidance; only durable server achievements can complete supported mission cards.

The Rewards history source-contract test was updated to assert the stricter account-scoped behavior rather than its previous unscoped implementation detail. A dedicated regression check was added and wired into both `prebuild:checks` and `verify:static`.

## Verification

Targeted source/policy checks passed:

| Check | Result |
|---|---:|
| New achievement account-isolation regression | 6/6 |
| Membership durable request guards | 10/10 |
| Wallet/rewards/membership concurrency and Pi recovery closeout | 43/43 |
| Verified non-financial mission contract | 31/31 |
| Rewards entry and balance truth | 18/18 |
| Rewards history and account isolation | 20/20 |
| Rewards release gate | 15/15 |
| Deep Rewards transformation | 24/24 |
| Membership transformation | 31/31 |
| Membership release gate | 16/16 |
| Membership session safety | 15/15 |

**Total: 229/229 targeted checks passed.** These are source and isolated policy checks, not live database, provider, browser or production-build evidence.

## Financial, database and deployment boundaries

- GHC and Pi remain separate assets, ledgers and settlement rails.
- Mission completion remains non-financial; no GHC or Pi issuance was enabled.
- Reward claims and membership purchases continue to rely on server-authoritative ownership, eligibility, idempotency and entitlement checks.
- No SQL migration was created, applied, replayed or marked applied.
- No user balances, ledger rows, membership entitlements or payment intents were changed.
- No Pi provider call, payout, withdrawal, paid checkout, deployment, promotion or Mainnet change was performed.
- Pi-funded GHC acquisition, paid business checkout, GHC issuance/settlement, withdrawals and payouts remain gated.

## Remaining acceptance gates

1. Node 24.15.x clean dependency install, typecheck, lint, full prebuild and production build.
2. Disposable PostgreSQL concurrency/idempotency rehearsal and reconciliation of REVIEW_REQUIRED migrations with actual Testnet history.
3. Authenticated multi-account Testnet journeys for reward maturity/claim/replay, mission evidence, Pi cashback statement, membership purchase/recovery/expiry and downgrade rejection.
4. Pi Browser, Android/WebView, accessibility, responsive and performance acceptance.
5. Preserve Mainnet-disabled posture until separate release approval and operator sign-off.

**Status:** Phase 3 source continuation delivered; release certification remains open. Production is not approved.
