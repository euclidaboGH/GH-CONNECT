# Phase 17 — Payment recovery coordination (0.106.0)

Built on Phase 16 payment lifecycle observability.

## What was added

1. **`lib/payments/coordinated-recovery.ts`**
   - `recoverPaymentIntent` → POST `/api/payments/intents/:id/recover`
   - `reconcileMembershipPurchase` → POST `/api/membership/reconcile`
   - `coordinatedRecoverPayment` — recover + optional membership reconcile + emit `ghc:payment-recovered`, `ghc:wallet-refresh`, `ghc:membership-activated` only after server success

2. **`GET /api/payments/recovery/status`**
   - Authenticated, no-store
   - Lists the caller’s durable intents that may need recovery or fulfilment attention
   - Does not invent provider events

3. **Recover route `featureAttempts`**
   - Honest notes for listing fee, community create fee, and membership after recover
   - Does **not** auto-publish listings or invent community rows

4. **Pi payment detail UI**
   - **Recover payment** button runs coordinated recovery and shows server-backed status text

## Explicit non-goals (preserved)

- No benefit grant from client-only status
- No fabricated audit timeline
- Pi listing/community fees still require a real completed intent before durable create

## Operator / Testnet

Verify: incomplete Pi payment → Recover → status advances; membership paid-but-free → Recover + membership reconcile; listing fee intent completed → retry publish with `feePaymentId`.
