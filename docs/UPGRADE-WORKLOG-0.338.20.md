# GreenHaven upgrade worklog 0.338.20

Date: 2026-11-10

## Run #242 — Pi withdrawal single-entrypoint repair

- Routed the wallet dashboard withdrawal focus action through the dedicated Pi withdrawal sheet.
- Removed the dashboard's direct POST submission path, which did not carry the server-bound withdrawal PIN proof.
- Kept the server-side Testnet request and executor gates fail-closed. This change does not enable payout execution, alter balances, apply migrations, or send Pi.
- Added a static regression guard for the single withdrawal entrypoint.

## Release identity

- Package and lockfile version: `0.338.20`.
- App release identity: `0.338.20`.
- Run #243 exposed stale regression assertions that still required `0.338.19`; these are aligned to the current package/release metadata in the Run #243 repair.

## Acceptance boundary

Static source checks do not prove that a live Pi Testnet withdrawal was accepted or transferred. Confirm the exact `POST /api/economy/earnings/withdrawals` response and separately verify database migration state, operator flags, wallet consent, executor readiness, settlement and recovery before enabling any payout intake.

Production remains NOT APPROVED.
