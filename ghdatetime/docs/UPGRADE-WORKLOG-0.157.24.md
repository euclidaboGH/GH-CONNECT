# GreenHaven upgrade worklog — v0.157.24

## Scope

Continue the Pi A2U earnings and four-month cashback work by exposing a private, read-only cashback statement in the existing Rewards Center and Wallet. No new top-level navigation was added. No payout route was added or enabled.

## Changes

- Added `gh_pi_cashback_user_statement(text, integer)` in migration `20261029010002_pi_cashback_user_statement_rpc.sql`.
- The RPC returns only entitlements matching the supplied canonical GreenHaven user ID, bounds result count to 1–50, returns PI atomic values as text, and labels each row `calculated_not_withdrawable`.
- The RPC is callable only by `service_role`; cashback tables remain inaccessible through direct grants.
- Added authenticated GET endpoint `/api/economy/rewards/pi-cashback`. It derives the user ID from the verified server auth context, never from a client query parameter, applies no-store headers and an upstream timeout, and fails closed if the migration/service is unavailable.
- Added `PiCashbackSummary`, embedded within Rewards Center and Wallet. It uses BigInt for exact 10^-7 PI display, provides a refresh action and period statements, and explicitly states that calculated rewards are not yet withdrawable.
- Added static contract checks and registered them in the prebuild and full static verification suites.

## Financial and release boundaries

- The statement displays calculated entitlements only; it does not equate them with available funds, withdrawable balance or a completed blockchain payment.
- No A2U payment is initiated, no Pi treasury is accessed, and no Supabase migration is applied by this change.
- Both cashback migrations remain `REVIEW_REQUIRED`. Validate both together on disposable PostgreSQL, reconcile remote migration history separately for Testnet and Mainnet, and test authenticated two-user isolation before applying.
- Full TypeScript/Next.js production build and live Supabase/Pi integration remain unverified in the current environment.

## Verification limitation

This is source-level/static verification only. The current audit runtime is Node.js 22.16.0, below the project Node.js 24.15.0 requirement, and dependencies are not installed; full TypeScript, lint and Next.js production build have not been verified.

## Validation run

- Full network-independent static verification: 53/53 passed.
- Pi cashback statement contract: 11/11 passed.
- Pi cashback ledger contract: 23/23 passed.
- A2U roadmap contract: 14/14 passed.
- Build type-regression guard: 7/7 passed.
- JSX safety: 826 files scanned, passed.
- Migration inventory: 142 files synchronized; 41 remain REVIEW_REQUIRED.
- Dependency installation, TypeScript, lint, production build, SQL execution, remote migration history, and live A2U/Testnet were not verified.
