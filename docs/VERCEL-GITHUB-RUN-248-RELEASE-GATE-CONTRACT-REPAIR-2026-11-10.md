# GitHub / Vercel Run #248 — release-gate contract repair (2026-11-10)

## Confirmed failure

GitHub Actions #248 stopped at prebuild check 009, `scripts/check-phase10-release-closure.mjs`. The diagnostic runner successfully enumerated and executed the declared prebuild list. The closure checker still inspected `package.json`'s `prebuild` string for individual check names, but `prebuild` now delegates to `scripts/run-prebuild-checks.mjs`; the actual check declarations live in `prebuild:checks`. Consequently, five correct release controls were reported missing even though they remained in the declared prebuild manifest and `verify:static`.

## Repair

- Added `scripts/lib/prebuild-command-contract.mjs`, a shared parser for the restricted direct-Node prebuild manifest. It rejects empty entries, shell syntax, unsafe paths, missing `.mjs` targets and missing files while preserving supported Node flags.
- Updated the prebuild runner to use the shared parser and retain shell-free `spawnSync(process.execPath, args)` execution.
- Updated the Phase 10 release closure checker to inspect `prebuild:checks` through the parser, while separately verifying that `prebuild` delegates to the diagnostic runner.
- Audited and updated 60+ legacy feature/programme checkers that were still inspecting the wrapper-only `prebuild` string; the affected assertions now read the declared manifest, including ordering and exact-once checks.
- Kept all five release controls in both prebuild and static verification: release hygiene, project truth, Phase 10 closure, Phase 10 platform acceptance and Phase 24 migration review.
- Added `scripts/check-run248-release-gate-runner.mjs` with 15 focused assertions and registered it in both verification lists.
- Updated Vercel's build command to clear the injected `npm_config_cache_dir` / `NPM_CONFIG_CACHE_DIR` variables in the build shell as well as the install shell. This addresses the fact that install and build commands run in separate shells.

## Verification

- Phase 10 release closure: 16/16.
- Run #248 release-gate runner contract: 15/15.
- Run #247 build diagnostics contract: 15/15.
- Phase 10 platform-wide acceptance: 24/24; Phase 24 final release review: PASS; Pass 36 system integrity: 8/8.
- Complete `npm run verify:static`: exit 0.
- Prebuild manifest dry-run: 278 commands discovered; all targets parse and exist.
- The original 277 checks are retained; one new focused Run #248 checker is appended.

## Boundaries

This repair fixes the confirmed GitHub #248 false-negative release-closure contract. It does not prove a complete Node 24.15.0 `npm run verify:static`, dependency-backed typecheck/lint, Vercel production build, or live Testnet acceptance. The available runtime is Node 22.16.0. No dependencies were upgraded, no native install scripts were approved, no SQL migrations were applied, no wallet balances/ledger/reservations changed, and no Pi payment/payout, GitHub push or Vercel deployment was performed. Production remains NOT APPROVED.
