# Phase 5 — Payment-intent concurrency and recovery test plan

**Environment:** disposable PostgreSQL first, then isolated Pi Testnet only after schema review. Never run destructive/concurrency experiments against Mainnet.

## Required scenarios

1. **Same idempotency key, same request:** issue 10 parallel `createPaymentIntent` requests for the same user/key/purpose/amount/currency/reference. Expect one durable row and every successful response to identify the same intent.
2. **Same idempotency key, different amount:** race two requests with the same user/key but different amount. Expect one winner and the other request to fail with `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`; never silently return a mismatched intent.
3. **Provider payment ID uniqueness:** concurrently bind one Pi payment ID to two intents. Expect exactly one binding; the other must return a conflict/unavailable result and never overwrite the winner.
4. **Completed versus failed callback race:** concurrently request `COMPLETED` and `FAILED` for the same open intent. Once a completed transition commits, a later failed/cancelled/incomplete callback must not downgrade it. If failure wins first, the completed transition must be rejected as terminal and queued for manual reconciliation.
5. **Duplicate completion:** run two `COMPLETION_PENDING`/`COMPLETED` attempts for one provider payment. Expect one logical completed state, one unique txid, idempotent retry responses, and no duplicate entitlement/ledger credit.
6. **Fulfillment retry:** call fulfillment in parallel after durable `COMPLETED`. Expect one durable `FULFILLED` state and idempotent entitlement handling.
7. **Database interruption:** terminate the connection between Pi provider completion and local status persistence. API must report reconciliation pending (not full success); recovery must query the provider and reconcile the same intent.
8. **Terminal downgrade:** try `FAILED`, `CANCELLED`, and `INCOMPLETE` after `COMPLETED` and `FULFILLED`. Expect rejection without row mutation.
9. **Privilege boundary:** run `PHASE5_PAYMENT_INTENT_POST_MIGRATION_ASSERTIONS.sql`; verify `anon` and `authenticated` cannot execute privileged RPCs and `service_role` can.
10. **Txid collision:** bind the same verified txid to two settled intents. Expect the unique index to reject the second transition; never mark both completed.

## Evidence to retain

- Exact migration versions and schema snapshot.
- SQL assertion output and test harness version.
- Parallel request counts and returned intent IDs/statuses.
- Database rows before/after each race, with secrets and user-identifying fields redacted.
- Pi Testnet provider response identifiers and transaction hashes, redacted where required.
- Confirmation that payout, membership, GHC ledger and creator payable side effects occurred at most once.

These scenarios are not marked passed by source-level JavaScript tests. They require actual PostgreSQL locking/index behavior and Pi Testnet evidence before release approval.
