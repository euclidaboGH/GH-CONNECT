# Phase 1 — A2U recovery fix (0.157.28)

## Defect
In `app/api/economy/rewards/pi-cashback/claim/route.ts`, when `getIncompleteServerPayments()` returned payments that did **not** match the current cashback request, the handler returned:

`UNRELATED_INCOMPLETE_A2U_PAYMENT_REQUIRES_REVIEW`

**without** calling `gh_pi_cashback_a2u_update(..., attention)`. The payout row stayed `status=processing` / `execution_state=initiating`. Subsequent claims re-selected the same processing row and hit the same blockage.

## Fix
Before returning the review-required error, the claim route now:

```ts
await update("attention", undefined, undefined, "UNRELATED_INCOMPLETE_A2U_PAYMENT")
```

SQL `gh_pi_cashback_a2u_update` already maps `p_state=attention` → `status=attention`.
`gh_pi_cashback_a2u_begin` then returns `CASHBACK_PAYOUT_REQUIRES_OPERATOR_REVIEW` until an operator resolves the incomplete queue / payout.

Matching incomplete payments for **this** `payoutRequestId` continue to resume (no new transfer).

## What this does **not** claim
- Does not prove a live Testnet Pi receipt
- Does not apply migrations to remote Supabase
- Does not enable Mainnet A2U

## Operator steps after deploy
1. Apply migration history only if Testnet DB is missing `20261029010004_pi_cashback_testnet_a2u_payouts.sql` (reconcile first).
2. Ensure Preview env: `PI_A2U_ENABLED=true`, `PI_A2U_TESTNET_ONLY=true`, `NEXT_PUBLIC_PI_SANDBOX=true`, server `PI_API_KEY` / wallet seed, funded Testnet app wallet.
3. Clear any stuck incomplete server payments in Pi dashboard if present.
4. Claim again with an eligible Testnet account; verify receipt + ledger `paid`.
