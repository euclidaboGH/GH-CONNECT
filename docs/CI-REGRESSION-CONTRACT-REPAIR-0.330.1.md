# CI regression-contract repair — 0.330.1

## Reported CI failures

The supplied GitHub Actions runs represented two different source revisions:

- Run #210 checked out 0.329.0 and failed the release-hygiene assertion because that checkout did not contain the root `.env.example` template. The 0.330.0+ source tree contains the safe template; the template uses empty placeholders and keeps privileged credentials server-only, with payout and economy switches disabled by default.
- Run #209 checked out 0.312.0. Its package/manifest assertions were pinned to that historical version and are not valid for later releases. The legacy Phase 5 readiness gate is now version-aware.

## Current source changes

- `scripts/check-phase2-dual-asset-wallet.mjs` validates the dedicated PI `Withdraw` action by its actual `id`, label and callback contract instead of expecting a ternary expression that the implementation no longer uses.
- `scripts/check-stories-rail-v2.mjs` validates the current emerald own-story card/avatar treatment rather than an obsolete gradient token.
- `scripts/check-phase5-release-readiness-2026-11-04.mjs` validates semantic version syntax and requires `VERIFIED_MANIFEST.txt` to match the current package version; it no longer hardcodes `0.312.0`.
- `scripts/check-phase9-membership-release-gate.mjs` now validates package/lockfile synchronization and the roadmap’s active release dynamically, instead of pinning the gate to 0.330.0.
- The safe root `.env.example` is retained and release hygiene verifies that privileged keys are not exposed with `NEXT_PUBLIC_` prefixes.

## Verification

- Release hygiene: 11/11
- Phase 2 dual-asset wallet: 11/11
- Stories rail v2: 9/9
- Phase 5 release readiness: 12/12
- Phase 5 wallet release gate: 17/17
- Phase 5 reliability: 14/14
- Phase 10 navigation/media source gate: 9/9
- Phase 10 navigation/media runtime tests: 7/7

These are source/static and targeted Node runtime tests. The local container uses Node 22.16.0, not the required Node 24.15.0, and dependencies are not installed. Therefore TypeScript, ESLint, full Next.js build and full CI are not certified here. GitHub Actions must be rerun against the committed 0.330.1 source to confirm the hosted workflow.

No migrations were applied. No Pi/Testnet/Mainnet transaction, GHC debit, payout, refund, or paid entitlement was executed. No financial authority changed.
