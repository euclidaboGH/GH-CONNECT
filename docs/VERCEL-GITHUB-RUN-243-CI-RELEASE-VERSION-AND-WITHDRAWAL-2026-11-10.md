# Run #243 — CI release-version assertion repair

## Source and scope

Source archive: `GREENHAVEN-0.338.20-RUN242-PI-WITHDRAWAL-SINGLE-PATH-REPAIR.zip`.
Package version: `0.338.20`.

## Root cause

Run #243 failed in `scripts/check-50-essential-upgrades.mjs` because the package was already `0.338.20` while the checker still required `0.338.19`. The app release constant was also stale at `0.338.19`. Related phase, performance and high-risk regression checks contained fixed `0.338.19` expectations. These assertions were not a reason to downgrade the package.

## Repair

- Aligned `APP_RELEASE_VERSION` and the in-app release summary to Run #242 / `0.338.20`.
- Changed release consistency checks to compare against the current `package.json` version rather than pinning a historical patch version.
- Updated the current derivative pointer in the consolidated audit register while preserving its historical baseline and findings.
- Added this report and the `0.338.20` worklog to document hygiene requirements.
- Preserved the existing Run #242 withdrawal single-entrypoint implementation and its fail-closed Testnet controls.

## Withdrawal submission interpretation

The durable route `POST /api/economy/earnings/withdrawals` requires authenticated identity, durable rate limiting, explicit Testnet request and executor flags, valid amount and idempotency key, PIN proof bound to user/key, a valid quote, verified Pi recipient and active wallet payout authorization before creating a reserved request. A successful request response explicitly states `transferSubmitted: false`; request creation is not proof that Pi was sent. Missing execution gates return 503 without reserving funds.

The Vercel evidence previously supplied showed a successful withdrawable-balance GET and a cancellation POST, not the exact withdrawal-submission POST invocation. Therefore live submission status remains unverified.

## Validation boundary

Run focused static checks and the complete `npm run verify:static` / CI suite under Node 24.15.0. Full clean-install typecheck, lint, build, browser/device checks, database/provider checks and live Testnet operator acceptance remain separate requirements. No migrations, environment settings, deployment, ledger balances or payout execution were changed. Production remains NOT APPROVED.
