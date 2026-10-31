# Phase 18 — Post-payment fulfilment orchestration (0.107.0)

Continues Phase 16 observability and Phase 17 recovery.

## Implemented

1. **`POST /api/payments/fulfill` expansion**
   - After marking COMPLETED → FULFILLED: membership + GHC packs (existing)
   - **Marketplace order** attach when intent metadata/reference proves order ownership and completed Pi payment
   - Honest **featureFulfilment** notes for listing fee and community create fee (retry create with feePaymentId; no invented rows)

2. **`lib/payments/fulfilment-client.ts`**
   - Client helper for server fulfilment only

3. **Coordinated recovery**
   - After recover reaches COMPLETED/FULFILLED, automatically calls fulfil

4. **Wallet `PaymentRecoveryBanner`**
   - Lists attention intents from `/api/payments/recovery/status`
   - Recover or Fulfil actions with honest messaging

## Non-goals preserved

- No client-only benefit grants
- No synthetic payment timelines
- Listing/community still require explicit create/publish with verified feePaymentId after Pi pay
