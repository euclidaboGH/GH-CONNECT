# Phase 4 — Controlled reward adapters (0.160.0)

## Goal
Connect legitimate reward sources to the unified PI earnings ledger through **controlled adapters** with eligibility, caps, fraud guards, and full audit. Do not reward fabricated views, self-interactions, or open faucets.

## Delivered
- Migration `20261029010007_gh_earnings_reward_adapters.sql` (attempt audit + day credited helper)
- `lib/server/earnings/reward-adapters.ts` — evaluateAndCreditReward
- `GET|POST /api/economy/earnings/adapters`
- Default **deny** unless `PI_EARNINGS_ADAPTERS_ENABLED=true` + `PI_A2U_TESTNET_ONLY=true` + Pi sandbox
- Guards: self-interaction, daily caps, per-reference max, integer atomic amounts, unique refs
- GHC issuance remains **Daily Claim only** (unchanged)

## Source kinds
activity_reward, creator_earning, referral, promotion, community, utility (system forbidden from client)

## Not claimed
- Automatic credit for every social action
- Mainnet adapter enablement
- Live funded reward pools beyond policy flags
- Remote migration applied

## Operator
1. Apply migration on Testnet after history reconcile
2. Keep adapters disabled until funding + anti-abuse review
3. Enable only on Preview: `PI_EARNINGS_ADAPTERS_ENABLED=true` with Testnet flags
