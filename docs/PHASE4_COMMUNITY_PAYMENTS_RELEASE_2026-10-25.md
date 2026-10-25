# Phase 4 — Community payments and release hardening

Release: `0.90.4` (based on the supplied `0.90.3` Phase 3 archive)

## Implemented

- Community creation now fails closed while offline instead of presenting a paid local-only group as a successful creation.
- The client obtains a server-authoritative Pi community-fee quote, creates a durable server-side PI intent, and invokes the existing Pi user-to-app payment integration before submitting the community creation request.
- The completed intent ID is passed to the server for owner, amount, currency, completion, and community-reference verification by the existing fee settlement layer.
- The client only hydrates the local community after the server reports durable creation. A local UI error no longer causes the caller to pretend a server create failed when the server already returned a durable community ID.
- Chat's legacy create-group path no longer inserts an optimistic local group or displays success unless the shared create operation returns a confirmed community ID.
- Community modal state is retained when creation fails, so the user can read the error and retry.
- The communities API checks durable database configuration before attempting fee settlement, preventing a fee debit when durable persistence is known to be unavailable.
- Version and release metadata updated to `0.90.4`.

## Validation performed in the available environment

- JSX safety: passed (772 files scanned).
- Production safety scan: 21 passed, 0 failed.
- Release hygiene: 11/11 passed.
- Project-truth checks: 10 passed, 0 failed.
- Database contract source: passed (114 executable tables across 131 migrations).
- Migration inventory: passed (131 migration files; checklist and verified manifest synchronized).
- Pi backend lock verification: passed.
- Dependency lock coverage/root version: passed.

## Limitations / operator validation required

- The runtime available for this build is Node.js `22.16.0`; this project declares Node.js `24.15.0`. A full TypeScript check, Next production build, and live Pi SDK/Testnet payment cannot be certified here.
- The community fee debit and community record creation are still separate server operations. If the fee settles but the subsequent community RPC fails transiently, the operator must verify/recover the idempotent fee reference and retry the same community ID; this release does not claim a single SQL transaction across both operations.
- Testnet validation should cover GHC insufficient balance, successful GHC debit, Pi cancellation, Pi completed intent, mismatched/foreign intent, duplicate submit, server unavailable before settlement, and transient create-RPC failure after settlement.
- Do not deploy to Mainnet solely on the basis of static checks. Verify applied migrations and two-account Pi Browser flows on Testnet first.
