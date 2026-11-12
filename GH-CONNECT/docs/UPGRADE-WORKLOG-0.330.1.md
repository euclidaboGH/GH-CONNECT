# Upgrade worklog — 0.330.1

**Scope:** Phase 10 CI regression-contract repair. This is a patch release that makes existing regression gates track the current source instead of pinning assertions to historical implementation details.

## Changes

- Updated dual-asset wallet test to verify the dedicated PI Withdraw action's ID, label and handler contract.
- Updated Stories rail test to verify the actual emerald own-story card/avatar treatment.
- Made legacy Phase 5 release readiness compare semantic package version and migration manifest dynamically rather than hardcoding 0.312.0.
- Made Phase 9 membership foundation, session safety and experience gates follow the active package/lockfile/release version and Phase 10 roadmap marker.
- Preserved safe `.env.example`, empty secret placeholders, server-only privileged credentials and fail-closed payment/payout switches.
- No application runtime behavior, database migration, wallet, Pi, GHC, payment, payout or entitlement authority changed.

## Verification

Targeted checks and the full `npm run verify:static` suite were executed. The first full-suite run exposed additional stale release-pinned assertions in the Phase 9 and Phase 1–12 gates; those assertions and their current-baseline reports were also corrected before the final rerun. Source-only checks do not establish production runtime acceptance. Node.js 24.15.0, dependency installation, TypeScript, ESLint, Next.js build, disposable PostgreSQL, Pi Testnet and browser/device acceptance remain required.

Final verification outcome: `npm run verify:static` completed successfully with exit code 0 after the Phase 9 and Phase 1–12 current-release assertions were reconciled. The final run contained no `FAIL` annotations. This does not replace the Node.js 24.15.0 CI run or the external acceptance gates listed above.
