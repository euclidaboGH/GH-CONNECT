# GreenHaven Phase 17 — Economy Surface Convergence

## Objective

Unify the visible economic state across Post Reward, Rewards Centre, Wallet, and the server social-economy control plane without creating any client-side issuance path.

## Implemented

1. **Post rewards hydrate immediately**
   - `PostRewardPanel` now loads its server-authoritative reward projection when the post card mounts instead of waiting for the reward sheet to open.
   - Existing `ghc:content-reward-updated` refresh behavior remains intact.
   - Amounts remain server-derived only.

2. **Rewards Centre uses the same economic control plane as Wallet**
   - Reads `/api/social/economy/status`.
   - Displays authoritative Available, Pending, Locked and Curation funding state.
   - This is presentation-only; it does not mint, credit, or mutate balances.

3. **Wallet remains authoritative**
   - Wallet continues to refresh its bound economy repository from `/api/economy/wallet/:userId`.
   - Social economy status remains a cross-surface state/diagnostic view.

4. **Post GET + reward projection remain integrated**
   - Direct post hydration includes durable content reward state.
   - Content reward reads fail closed when the reward system is unavailable or inactive.

## Safety invariants

- No client-created GHC.
- No client-supplied reward amount is trusted.
- Comments, likes and views do not mint GHC.
- Curation contribution can only move existing wallet value through server-authoritative settlement.
- Wallet and Rewards Centre do not calculate balances from partial client activity.

## Verification

`node scripts/test-phase17-economy-surface-convergence.mjs`

**PASS — 15/15 static contract checks.**

No Next.js build/typecheck/lint result is claimed here because this working environment does not contain the project's installed dependency tree.
