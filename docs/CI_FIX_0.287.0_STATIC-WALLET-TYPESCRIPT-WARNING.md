# CI correction — 0.287.0 wallet/rewards static contract and Node warning

## Changes

- Updated the Wallet pending-hold explanation to state that holds mature after validation and that ready rewards can be released to the available balance. This restores the Phase 3 wallet/rewards education contract without changing claim APIs, ledger authority, auto-settlement, or wallet behavior.
- Declared the package as ESM (`type: module`) so Node no longer has to infer the module format of imported TypeScript files at runtime.
- Suppressed only Node's experimental type-stripping warning on scripts that explicitly use `--experimental-strip-types`. The type-stripping behavior and tests remain enabled.

## Verification

- `npm run verify:static`: PASS, 57/57.
- `scripts/check-phase3-wallet-rewards-separation.mjs`: PASS, 13/13.
- `scripts/test-pass45-rate-limit-contract.mjs`: PASS.

A full TypeScript check and production build must be run under the repository-pinned Node.js `^24.15.0` runtime. The editing environment only provided Node.js 22.16.0, which the repository correctly rejects, and dependency installation could not complete within the available network/time limit. No claim is made here that the full typecheck/build has passed.
