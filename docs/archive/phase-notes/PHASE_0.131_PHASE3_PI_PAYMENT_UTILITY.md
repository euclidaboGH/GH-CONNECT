# Phase 3 of 5 — π payment utility proof (0.131.0)

## Shipped
- Listing + community fee quotes force **PI** when `GHC_PI_ONLY_COMMERCE` is on
- `GET /api/payments/utility-status` — rail readiness + sandbox steps
- Fulfil records `payment_completed` pioneer activity
- Wallet: Pi payment utility status panel next to recovery

## Live evidence you must still collect (Testnet)
1. Publish a listing and complete π listing fee in Pi Browser sandbox
2. Create a community with π create fee when rates require settlement
3. Use Payment recovery → Fulfil if status is COMPLETED but not FULFILLED
4. Confirm listing/community is not invented without a durable completed intent

## Env
- `PI_API_KEY` (Testnet key on Testnet app)
- `NEXT_PUBLIC_PI_SANDBOX=true`
- `PI_ENV=sandbox`
- `GHC_PI_ONLY_COMMERCE=1`
- Fee amount envs as already documented for listing/community
