# Phase 6 — Initial GHC issuance guard (restrictive candidate; roadmap amendment required)

## Scope implemented in this source candidate

> **Product-policy amendment (2026-10-18):** This implementation is intentionally stricter than the owner-approved target. Before Testnet rollout, amend it to permit a dedicated qualifying-referral issuance RPC (5% of canonical approved VIP GHC price) and restore curation creator rewards as ledger-funded redistribution from upvoters. Do not simply re-enable the old curation minting RPC.

- Added `202610180009_ghc_daily_claim_only_issuance.sql`, a database-level ledger trigger that permits only:
  - Daily Claim user entitlements with `rewardLifecycle=daily_claim_48h` while pending;
  - the corresponding posted Daily Claim redemption with `claimKind=DAILY_CLAIM_V12`;
  - the internal protocol reserve leg on `__PROTOCOL_RESERVE__` with `PROTOCOL_RESERVE_V12` metadata;
  - positive `transfer_in` rows posted as `WALLET_TRANSFER`, which redistribute existing GHC.
- Other positive credits and staged pending reward rows are rejected by the trigger. A `transfer_in` is allowed only when a matching posted `transfer_out` exists in the same reference, with matching amount and counterparties.
- Revokes service-role execute on the generic `ghc_stage_pending` RPC when the expected overload exists.
- Replaces the curation reward function with a no-credit result so the vote itself can still succeed without minting GHC. This is a temporary placeholder; the roadmap now requires a balance-funded redistribution implementation.
- Disables `/api/economy/rewards/evaluate` and `/api/economy/ledger/credit` at the HTTP boundary.
- Adds a domain-layer guard in `evaluateRewardAuthoritative` so internal callers also fail closed.
- Blocks generic local/Studio reward evaluation, manual credits, purchase credits, generic pending staging and generic pending redemption; the emission registry now explicitly marks each path as disabled issuance or redistribution.
- Leaves the dedicated Daily Claim and GreenHaven ID transfer paths intact. Pi purchase credit is already not wired and remains unavailable.
- Adds `scripts/test-daily-claim-only-issuance.mjs` to `ci:verify`.

## Important implementation details

- Existing ledger rows are not deleted, rewritten, or revalued.
- Negative compensating entries and existing transfer-out/spend entries are not blocked by this positive-credit guard.
- Curation votes remain available; their GHC reward side effect is disabled.
- Historical pending rewards from non-Daily-Claim sources can no longer be converted into positive posted credits through the guarded ledger path. This is intentional under the new policy, but must be reviewed against live Testnet pending entitlements before migration approval.
- The trigger guards table-level inserts/posted updates, including writes made from existing `SECURITY DEFINER` functions. The service-role RPC revoke is defense in depth, not the only control.

## Checks

- New static policy test: **31/31 assertions passed**. It checks the trigger allowlist, 48-hour lifecycle metadata, paired-transfer exception, curation no-op, API/domain/store gates, policy-aware emission registry, and preservation of ledger history.
- All **83** `scripts/test-*.mjs` source-level regression scripts passed after updating older reward tests to reflect the new policy. This is not a PostgreSQL integration test or a production build.
- Existing daily claim, wallet, transfer, economy, social, and release tests must be rerun on this candidate.

## Not verified / not done

- No PostgreSQL parser or live Supabase database was available; SQL syntax and runtime behavior still require Testnet application in an isolated project after schema/history reconciliation.
- No live database migration, Testnet transaction, GitHub push, Vercel deployment, or Mainnet operation was performed.
- Clean dependency installation, TypeScript, ESLint, and Next.js production build remain pending because the previous dependency installation timed out.

## Required policy redesign before Testnet migration approval

1. Add a dedicated referral issuance exception with durable referral attribution, canonical VIP price lookup, 5% calculation, one-time idempotency, fraud controls, and settled-payment eligibility.
2. Replace the curation no-credit stub with atomic debit/credit redistribution; total user-available GHC must not increase from curation.
3. Membership GHC prices have been reconciled to VIP 150 monthly / 1,800 annual list and VVIP 300 monthly / 3,600 annual list; the 20%-discounted 12-month charges are 1,440 / 2,880. Full 1/4/8/12-month UI, bonus-month fulfillment and durable payment products remain Phase 7 work.
4. Add configured utility fees for marketplace listing and community creation, with separate GHC ledger debit and verified Pi payment-intent paths. Proposed pilot fees are 5 GHC or 0.05 Pi per listing and 50 GHC or 0.5 Pi per community; these remain recommendations pending product/operator approval.

## Testnet migration approval checklist

5. Confirm `ghc_transactions`, the exact 10-argument `ghc_stage_pending` overload, `ghc_curation_reward_credit(text,text,text,numeric)`, and Daily Claim RPC signatures/ACLs.
6. Inventory historical non-Daily-Claim pending rows and document the support/expiry treatment before enabling the trigger.
7. Apply to a disposable Testnet project first. Test Daily Claim pending insertion, redemption before/at/after 48 hours, duplicate/replayed redemption, and concurrency.
8. Test that activity staging, curation reward credit, admin credit, purchase credit, and direct positive ledger writes are rejected; verify curation votes still succeed without rewards.
9. Test direct GreenHaven ID transfers and transfer-request acceptance; prove total user GHC is conserved across sender and receiver.
10. Run full `ci:verify`, including a clean install/typecheck/lint/build, then capture migration and test evidence before any wider rollout.
