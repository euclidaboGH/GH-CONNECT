# Phase 4 — Pi earnings withdrawal identity, consent and settlement boundary

## Scope and product separation

This document describes the **Pi earnings A2U payout lane** implemented under `/api/economy/earnings/**`. It is separate from the RUN376 **GHC-to-Pi manual withdrawal-request lane** under `/api/economy/withdrawals`. The two systems must not share balances, ledger entries, payout executors or operator secrets.

The word “KYC” in the UI/checklist refers here to a linked Pi identity and wallet-authorization check. The inspected implementation does not perform government-issued identity verification and must not be described as statutory identity KYC.

## Quote and request lifecycle

1. `POST /api/economy/earnings/quote` authenticates the GreenHaven session, applies a durable per-user rate limit, parses a bounded request and computes the quote from the server-side unified earnings ledger. The server derives the recipient from the mapped Pi identity; the request body cannot choose a destination.
2. The quote uses the 3% fee policy (`fee_bps=300`) and reports gross, fee and net in Pi atomic units. The server validates integer bounds and available/maximum payout limits.
3. `POST /api/economy/earnings/withdrawals` creates a durable payout request only when `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true`, `PI_NETWORK=testnet`, and the Testnet execution worker is also enabled with `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=true`, `PI_A2U_ENABLED=true`, and `PI_A2U_TESTNET_ONLY=true`. This avoids reserving a balance that no enabled worker can settle or safely release.
4. Request creation requires a valid request-bound withdrawal PIN proof, a linked Pi recipient UID, and active wallet payout authorization. It uses a durable idempotency key and a request fingerprint bound to user, network, amounts and recipient.
5. A successful request response explicitly returns `transferSubmitted:false`. A request is not proof that Pi was sent.

## Dedicated Testnet A2U executor

The execute endpoint is a separate worker path. It requires an authenticated operator context, a dedicated `PI_EARNINGS_EXECUTOR_KEY` with at least 32 bytes and constant-time comparison, a durable rate limit, `PI_NETWORK=testnet`, `PI_A2U_TESTNET_ONLY=true`, and the explicit execution flags. `PI_ENV=production` selects the Pi Platform API environment; it does not mean Pi Mainnet. Network selection remains `PI_NETWORK=testnet`.

Before settlement, the worker:

- begins/leases the payout request through the domain RPC;
- rechecks mapped identity and active payout authorization immediately before A2U;
- checks incomplete provider payments and recovers only an exact request-bound match;
- binds the provider payment ID to the payout request;
- retrieves the payment and verifies identifier, `app_to_user` direction, `Pi Testnet` network, recipient UID, amount and request metadata;
- requires a valid provider `to_address` and compares it with the authorized wallet address, or uses the narrowly scoped provider-address adoption RPC where the authorization is scope-only;
- queues mismatches and unrelated incomplete payments for operator review rather than redirecting funds;
- releases a reservation only on provider-confirmed cancellation with no transaction, and otherwise preserves uncertain state for reconciliation.

The execution worker is not interchangeable with marketplace seller payouts, cashback, referral settlement or GHC withdrawals. The unified earnings ledger and domain-specific RPCs remain authoritative.

## Operator gates

- Keep request and execution flags disabled by default until the reviewed migration, Testnet receipt verification, worker secret, Pi SDK/Platform credentials and rollback/reconciliation path are all verified.
- Keep `PI_A2U_TESTNET_ONLY=true` for any Testnet execution. Do not enable Mainnet through this Phase 4 path.
- Verify wallet authorization scope and the provider `to_address` against the mapped Pi identity before final settlement.
- Treat provider timeouts, missing transaction IDs, address mismatches and unrelated incomplete payments as uncertain; never infer successful transfer from request creation.
- The RUN376 GHC-to-Pi request lane remains separate, disabled by default, Preview/local Testnet only, and manual operator settlement. It does not call this Pi earnings A2U worker.

## Verification boundary

The Phase 4 source contract checks verify route existence, Testnet gates, PIN proof, explicit non-submission on request creation, wallet authorization, the 3% fee presentation and wallet refresh wiring. They do not prove a live Pi Testnet payment, provider receipt, deployed migration, actual wallet ownership or Mainnet readiness. Live operator and Testnet evidence is still required.
