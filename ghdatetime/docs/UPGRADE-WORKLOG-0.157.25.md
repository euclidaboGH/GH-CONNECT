# GreenHaven v0.157.25 upgrade worklog

## Scope

This increment hardens the cashback period close against late-arriving verified revenue events. Previously, the privileged close RPC could be invoked immediately after a four-month UTC window ended. Since revenue journaling and payment recovery can be delayed, an event verified within the period but appended after close could be omitted from an immutable cashback snapshot.

## Change

- Added `20261029010003_pi_cashback_period_reconciliation_grace.sql`.
- The migration renames the existing validated close implementation to a private underlying function, removes API-role execute access to that underlying function, and creates a service-role-only wrapper.
- The wrapper refuses period close until seven days after `ends_at`, returning `PERIOD_RECONCILIATION_WINDOW_OPEN` and the `reconciliationAvailableAt` timestamp.
- The original earning interval remains `[starts_at, ends_at)` and the original four-month UTC validation, idempotency and entitlement calculation remain delegated to the existing implementation.
- Added `scripts/check-pi-cashback-period-grace.mjs` to `prebuild` and the full static verification runner.
- Updated the migration inventory and release/project-truth documentation.

## Safety boundaries

- Migration is classified `REVIEW_REQUIRED`; it has not been applied to Supabase.
- Before application, test function ownership, `SECURITY DEFINER` behavior, ACLs after rename, concurrent close attempts, exact UTC boundaries and the seven-day gate on disposable PostgreSQL.
- Reconcile remote Testnet and Mainnet migration history before any application.
- No payout endpoint, A2U authorization, user-withdrawable state, or live payment was added.
- This increment does not assert that all revenue producers are attributed yet.

## Verification

The new contract provides source-level static SQL checks and release-suite registration. Full TypeScript/Next.js production build and live database/provider tests must be run under the project's supported Node.js 24.15.0+ runtime after dependencies are installed.

The audit environment currently uses Node.js 22.16.0, below the project-required Node.js 24.15.0 baseline, and project dependencies are not installed. Full TypeScript, lint, production build, browser, disposable PostgreSQL and live Pi Testnet checks have not been run and remain release gates.
