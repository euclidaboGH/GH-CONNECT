# Stage 7 — Scale and Release Readiness

## Scope
Stage 7 establishes a server-owned release gate for production scale: build/quality evidence, payment-to-ledger reconciliation, authorization and RLS, observability, recovery/rollback, and staged rollout. The gate is deliberately descriptive and read-only; it does not claim that checks have run or passed.

## Read-only endpoint
`GET /api/release/readiness` returns the current release checklist. It is not an attestation, does not reveal environment variables, and cannot deploy or enable features.

## Required evidence before release
- Clean dependency install, typecheck, lint, production build, and complete `ci:verify` on the release commit.
- Provider-verified payment state transitions, unique idempotency keys, durable ledger reconciliation, and tests for duplicate/concurrent callbacks, delayed settlement, refunds, reversals, and partial failures.
- Cross-account authorization and IDOR tests, database RLS/grants review, rate limits, abuse controls, and dependency/secret scans.
- Redacted structured logs, health/readiness checks, actionable alerts, incident response ownership, and tested backup/restore plus rollback procedures.
- Testnet multi-user evidence, canary thresholds, rollback triggers, and written product/finance/platform-policy/legal approvals for financially sensitive functionality.

## Safety constraints
Pi-funded GHC acquisition and paid business checkout remain disabled until their own activation gates pass. A policy response or passing static test is not a substitute for live provider verification or operator approval. Do not log secrets, raw payment payloads, personally identifying data, or full wallet identifiers.

## Release procedure
1. Freeze the release commit and record its hash.
2. Run the full CI suite in the supported Node environment.
3. Apply reviewed migrations only through the approved operator workflow and verify RLS/grants.
4. Complete Pi Browser Testnet and multi-account evidence collection.
5. Verify reconciliation, alerts, backups, rollback and kill switches.
6. Obtain documented approvals, deploy to a canary, observe defined thresholds, then expand gradually.
7. If any gate fails, stop rollout and follow the rollback runbook; never bypass a gate to make CI green.

Current state: **not release approved**. This document and endpoint define the controls; they do not certify live production readiness.
