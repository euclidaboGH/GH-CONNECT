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

## Runtime verification boundary

- This is source-only verification; it does not substitute for a dependency-backed build or live operator acceptance.
- This source review environment uses Node.js 22.16.0 and does not contain `node_modules`; the project requires Node.js 24.15.0. Accordingly, this worklog does not claim a dependency-backed TypeScript, lint, or Next.js production build pass. Those checks must run on the pinned Node.js 24.15.0 CI runtime.
- Static source checks do not prove provider execution, remote database state, or live Pi Testnet transfer acceptance.

## Acceptance boundary

Static source checks do not prove that a live Pi Testnet withdrawal was accepted or transferred. Confirm the exact `POST /api/economy/earnings/withdrawals` response and separately verify database migration state, operator flags, wallet consent, executor readiness, settlement and recovery before enabling any payout intake.

Production remains NOT APPROVED.

## Run #244 — manifest, release truth and withdrawal-checker hardening

- Regenerated the 199-file migration inventory metadata for `0.338.20`; no SQL files or classifications were changed.
- Strengthened project-truth verification to require deterministic migration inventory synchronization.
- Updated the Phase 1–12 and Phase 12 release snapshots to the current `0.338.20` baseline while preserving historical-fixture labels and production NOT APPROVED status.
- Updated the wallet authorization regression contract to follow the current dedicated Pi withdrawal sheet and its PIN-bound idempotency intent instead of retired dashboard state.
- Added exact Node.js 24.15.0 CI runtime assertions and sanitized Vercel's npm install environment from the obsolete cache-dir aliases.
- Focused verification: project truth 11/11; Phase 1–12 consolidation 24/24; request-boundary follow-up 14/14; Phase 12 release readiness 28/28; release hygiene 13/13; wallet authorization 27/27; migration source manifest 199/199; documentation hygiene PASS; full `npm run verify:static` 57/57 plus trailing wallet authorization contract PASS.
- Node 22.16.0 / no `node_modules` means dependency-backed typecheck, lint and Next.js build are not verified in this environment. The supplied Vercel excerpt omits the actual compiler diagnostic; capture the full build output before claiming the build issue is resolved.
- No migrations, wallet balances, provider transfers, deployment settings or production state were changed. Production remains NOT APPROVED.
