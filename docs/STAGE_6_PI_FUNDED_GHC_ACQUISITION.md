# Stage 6 — Pi-Funded GHC Acquisition Proposal

**Release:** 0.63.22  
**Status:** Proposal and read-only policy only. Not a payment integration. Not deployed. No database migration applied.

## Objective

Define a safe, auditable route for evaluating whether users may acquire GHC utility units through an approved Pi payment flow in a future release. Stage 6 does not assert that conversion is permitted, approved, economically sound, or ready for production.

## Delivered in this source pass

- Added a server-owned proposal registry with three illustrative packs.
- Pack amounts and Pi prices are `null`; all packs are explicitly non-purchasable.
- Added `GET /api/economy/pi-acquisition-policy`, a read-only endpoint with bounded public caching and security headers.
- Added an automated source regression test and wired it into `ci:verify`.
- Kept Pi checkout, automatic conversion, and durable GHC credit disabled.
- Added explicit activation gates for economics, platform policy, legal review, verified settlement, ledger idempotency, refunds/reversals, security, reconciliation and end-to-end tests.

## Non-negotiable financial invariants

1. A client callback, redirect, screenshot, or submitted transaction identifier cannot authorize a GHC credit.
2. Only server-verified settlement can enter the credit workflow; credit must be idempotent and recoverable after partial failures.
3. Pi payment state and GHC ledger state remain separate sources of truth, joined by a durable unique settlement reference.
4. Duplicate callbacks, concurrent requests, delayed settlement, cancellation, expiry, disputes and refunds must not create duplicate or unsupported spendable GHC.
5. No exchange rate, cash redemption, investment return, or guaranteed value is implied.
6. No live flag may override missing verification, ledger, reconciliation, or approval gates.

## Required before any activation

- Product/finance approval for pack amounts, prices, supply impact, taxes, refund/cancellation terms and user disclosures.
- Confirm current Pi Platform rules and obtain legal/compliance approval for the exact flow and jurisdictions.
- Implement server-side payment verification, signed/validated provider events where available, replay protection, idempotency keys and durable payment state transitions.
- Implement a database-backed settlement-to-ledger workflow with unique constraints, transactional credit or durable outbox/recovery, immutable audit events and reconciliation reports.
- Verify authentication, authorization, RLS/grants, abuse throttles, monitoring, alerting and rollback/recovery runbooks.
- Run concurrency and failure-injection tests, disposable database migrations, full CI/build and Pi Browser Testnet tests using at least two accounts.
- Obtain written release approval from product, finance, legal/platform-policy review and engineering.

## Verification

Run `node scripts/test-phase6-pi-ghc-acquisition.mjs` for source-level checks. Passing this test does not establish production readiness. TypeScript, lint, production build, full CI, database integration, and live Testnet/Pi Browser flows have not been verified in this source pass.

## Operator instruction

Do not add or enable a production environment variable to bypass these gates. The policy endpoint is informational; it is not checkout authorization. No migrations or deployments are performed by this change.
