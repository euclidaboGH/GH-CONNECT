# Phase 20 payout concurrency and failure-injection plan

Run only on a disposable PostgreSQL database and Pi Testnet. Never use Mainnet for these tests.

## Pi A2U

1. Prepare two different approved/processing PI seller payout requests and one Testnet app-wallet seed/API key.
2. Invoke `gh_pi_a2u_begin_execution` concurrently for different requests with distinct lease tokens. Exactly one must acquire the global lease; the other returns `PI_A2U_SEQUENCE_BUSY`.
3. Invoke the same request concurrently. Only one active lease and one execution row may exist for that payout request.
4. Simulate crash immediately after SDK `createPayment` but before saving the payment ID. Retry must recover the matching incomplete payment by `metadata.payoutRequestId`; it must not create another.
5. Simulate crash after chain submission but before saving `txid`. Retry must inspect `getPayment` and reuse the existing verified transaction; it must not submit again.
6. Simulate crash after provider completion but before reconciliation. Retry must confirm the same provider payment/txid and finish reconciliation idempotently.
7. Verify wrong UID, amount, metadata request ID, direction, network, transaction ID, cancelled status, missing verification, and non-completed provider status all block `paid`.
8. Verify unrelated incomplete provider payment blocks new creation and is not auto-cancelled.
9. Verify an `attention` execution cannot be automatically retried and requires operator review.
10. Force SDK timeouts and DB RPC failures. The route must return retryable failure and preserve durable state; no duplicate payout is permitted.

## GHC seller payouts

1. Request must be `processing`, currency GHC, and fully allocated to the seller's completed/verified GHC orders.
2. Set treasury spendable balance below payout amount. Settlement must return `INSUFFICIENT_FUNDED_TREASURY` with no debit, credit, settlement row, or paid status.
3. Make two concurrent calls for one payout. Exactly one debit leg, one credit leg, one settlement row, and paid status must exist; the second call is idempotent.
4. Reuse a reference with mismatched parties/amount and verify `IDEMPOTENCY_CONFLICT` or `TRANSFER_PAIR_INCOMPLETE` without further movement.
5. Restrict the treasury or seller and verify settlement fails without ledger mutation.
6. Mutate an allocated order to unverified, wrong seller, wrong currency, or incomplete status and verify `PAYOUT_ORDER_BACKING_INVALID`.
7. Verify the operator transition endpoint cannot set `paid` and that only the atomic GHC settlement function can do so for GHC requests.
8. Verify RLS and function ACLs with `PHASE20_POST_MIGRATION_ASSERTIONS.sql`.
