# Upgrade worklog — 0.183.0

## Phase 4 PI earnings payout request foundation

- Added `20261030010002_pi_earnings_payout_requests.sql` as an additive, review-required migration.
- Added a dedicated durable payout request table with user-scoped idempotency, payload fingerprint, gross/fee/net conservation, linked recipient snapshot, Testnet-only create RPC, unique provider-reference constraints, deny-all RLS and service-role-only function ACLs.
- Request creation and gross reservation run in one database transaction. Same-user requests serialize on an advisory transaction lock. Reusing an idempotency key with changed payload returns `IDEMPOTENCY_CONFLICT`.
- Added authenticated bounded-body API `POST /api/economy/earnings/withdrawals`. It obtains the quote server-side, binds recipient and amounts in a SHA-256 fingerprint, and is disabled unless `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true` and `PI_NETWORK=testnet`.
- Added an uncertain-outcome transition that retains the reservation. No automatic release is allowed when provider outcome is unknown.
- Added 21 source contract checks and included them in `prebuild` and `verify:static`.

## Explicitly incomplete / release blockers

- No general PI earnings provider execution adapter is wired to this request table.
- No independently verified provider receipt RPC or settlement transition is implemented.
- No authoritative provider-negative reconciliation/release workflow is implemented.
- No failure-injection PostgreSQL tests, multi-session concurrency tests, or Testnet payout lifecycle evidence are available. The 21 checks are static source-contract checks only.
- Do not enable the request feature flag on a live project until migration review/application and disposable PostgreSQL tests pass. Do not submit payouts or enable Mainnet.
- Node.js 24.15.0 is required; the available runtime during this work was Node 22.16.0. Typecheck, lint, and production build are therefore not certified.

Verification classification: the current automated checks are source-only verification; they do not replace isolated PostgreSQL execution, provider failure injection, concurrency testing, or Testnet operational evidence.
