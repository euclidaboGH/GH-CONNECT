# Product economy integration — 2026-10-18

Wires Stages 3–5 foundation into user-facing and API surfaces.

## Referral
- `ReferralShareCard` on Profile ecosystem hub (code + copy/share)
- `?ref=` capture on app load → localStorage → `POST /api/referral/attribute` after auth
- Membership activate still queues 5% reward; settlement remains flag-gated

## Curation
- After durable upvote, optional `ghc_curation_redistribute` when `GHC_CURATION_REDISTRIBUTE_ENABLED=1`
- Amount: min(1, rewardPercentage/100 * 0.1) GHC from voter spendable

## Fees
- Listing fee supports `GHC_MARKETPLACE_LISTING_FEE_GHC` as well as Pi
- Community create quotes pilot fee; if rates approved, fail-closed until payment verifier ships (no free bypass when env set)

## Tests
`npm run test:product-economy-integration`
`npm run test:stage3-5-economy`
