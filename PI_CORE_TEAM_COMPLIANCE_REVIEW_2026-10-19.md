# Pi Integration and Compliance Review — Engineering Draft

**Status: engineering checklist only. This is not a Pi Core Team approval, legal opinion, or authorization to launch financial products.** Obtain current platform guidance and qualified legal review before production financial changes.

## Identity and payment requirements

- Pi identity must rely on server-side `/v2/me` verification. A client-provided username or UID is not proof of identity.
- Payment approval and completion must use the supported Pi SDK/backend flow, validate payer, payment ID, amount, product and network, and remain idempotent under retries.
- `pi-backend` integration for App-to-User (A2U) payouts remains **Testnet-only** unless the official current SDK guidance, environment, operator authorization, funding and release checks explicitly permit a later production use.
- `PI_A2U_ENABLED` stays disabled by default; Testnet mode must be enforced server-side, not merely by a UI toggle.
- Do not mix Pi transaction records with GHC ledger balances or imply that GHC is redeemable for Pi.

## Release gates — do not skip

1. Confirm current official Pi platform requirements and app permissions.
2. Verify Pi Testnet sign-in and payment completion in Pi Browser.
3. Test payer/amount/product/network mismatch, callback replay, interrupted payments and recovery.
4. Confirm no duplicate fulfillment or GHC credit across concurrent/replayed callbacks.
5. Keep A2U, exchange, redemption and withdrawal features disabled until independently reviewed and funded.
6. Record sanitized Testnet evidence and explicit operator approval before a separate Mainnet release review.

## Regulatory note

This draft does not decide whether a particular payment, custody, exchange, transfer, or payout product is legally permitted. Seek Nigerian legal and regulatory advice for the exact service and operating model before enabling such features.
