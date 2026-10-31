# Upgrade worklog — 0.185.0

## Phase 4 — dedicated PI earnings execution and receipt reconciliation

- Added an isolated authenticated `POST /api/economy/earnings/withdrawals/execute` route for general earnings; seller and cashback payout records are not reused.
- Added a durable global Pi A2U lane lease plus per-request execution lease and attempt tracking. Provider calls occur outside database transactions.
- The worker resumes a persisted provider payment ID or recovers an exact matching incomplete payment before considering creation. An unrelated incomplete A2U payment blocks creation for operator review.
- Provider payment ID is persisted before submission; rebinding is rejected.
- The worker independently fetches the payment after developer completion and checks request metadata, direction, Testnet network, canonical recipient, net amount, txid, transaction verification and developer completion before settlement.
- Ambiguous provider outcomes preserve the gross reservation and become recoverable; no automatic release occurs.
- Worker is disabled by default and guarded by explicit Testnet flags and a server-side operator secret. Mainnet remains disabled.

## Validation

All completed automated checks in this candidate are source-level contract checks; they are not live PostgreSQL or Pi network execution tests.

- Execution-worker source contracts: 17/17.
- Request lifecycle contracts: 21/21.
- Settlement/recovery contracts: 15/15.
- Production safety scan: 21/21.
- Release hygiene: initially 10/11 before updating current-version references; rerun required.
- Node runtime gate: blocked because the available runtime is v22.16.0 while the project requires Node.js 24.15.0 or compatible Node ^24.15.0. Therefore TypeScript, lint and production build are not claimed as passed.
- PostgreSQL integration/failure-injection/concurrency and authenticated Pi Testnet E2E were not run. Do not enable execution or apply migrations to live Testnet until those checks are completed.
