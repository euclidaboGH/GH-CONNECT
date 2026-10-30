# GH Connect v0.202.0 — Phase 25 operational workflow foundations

## Scope

This phase adds server-only database workflow foundations for provider refund outcome recording, append-only dispute decision evidence, approved historical payout correction evidence, and transactionally locked membership renewal from a canonical completed payment intent. Canonical marketplace orders, seller-net proceeds, marketplace adjustment rows, payment intents, and membership entitlements remain authoritative.

## Important limits

- Migration `20261030010014_phase25_operational_financial_workflows.sql` is **REVIEW_REQUIRED** and has not been applied to any database.
- The refund RPC records a result only after a trusted server-side provider adapter has independently verified the provider response. This migration does not call Pi, GHC, or any external refund provider.
- Dispute and payout-correction tables are immutable evidence journals; this phase does not yet provide a complete adjudication/appeal API or execute approved historical allocation corrections. No historic allocation is rewritten.
- Membership renewal requires completed canonical payment intent plus trusted catalog/currency verification markers. The existing production writer path must be reviewed and integrated with this RPC before it is considered operational; the markers alone are not independent proof of provider settlement.
- The migration must be validated against a disposable PostgreSQL instance. No PostgreSQL execution, provider Testnet refund, concurrency test, or live entitlement renewal test has been run in this environment.
- Static source-contract checks do not establish SQL syntax/runtime correctness or operational readiness.

## Verification intent

Run `npm run check:phase25`, `npm run verify:static`, `node scripts/generate-migration-inventory.mjs --check`, and the full CI typecheck/lint/build gates on supported Node.js 24.15.0. Before applying the migration, validate table/function dependencies and execute duplicate, conflicting idempotency, provider retry, concurrent renewal, transaction rollback, and permissions tests on disposable PostgreSQL.

All checks in this worklog are source-only/static checks. The environment used for this work was Node.js v22.16.0; the project requires Node.js 24.15.0.
