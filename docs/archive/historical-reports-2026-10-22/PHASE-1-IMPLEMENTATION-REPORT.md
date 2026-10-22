> HISTORICAL RECORD — not current release status. Check `docs/PROJECT_TRUTH.md` and current CI evidence before relying on this report.

---

# GH-CONNECT 10-Phase Remediation — Phase 1 Report

**Baseline:** GH-CONNECT v0.63.25 (`GH-CONNECT-0.63.25-10-PHASE-REMEDIATION-START.zip`)
**Phase:** 1 — Build and dependency stability
**Status:** Partially implemented; source-level checks pass; clean dependency install and compiler/build gates remain blocked in this execution environment.

## Scope completed

1. Added `scripts/check-node-runtime.mjs`, a fail-fast runtime preflight matching the repository's declared supported ranges: Node `^22.22.2` or `^24.15.0`.
2. Added `scripts/test-node-runtime.mjs` with boundary tests for accepted and rejected runtime versions.
3. Registered `check:runtime` and `test:runtime-contract` package scripts.
4. Updated the local `npm run ci` helper to check the runtime before starting a clean install.
5. Updated `ci:verify` to run the runtime preflight and its contract tests.
6. Wired runtime preflight into all GitHub Actions CI jobs before dependency installation.
7. Extended `scripts/test-phase1-release-readiness.mjs` to guard the new runtime policy and wiring.

## Verification results

- `scripts/test-node-runtime.mjs`: **10/10 passed**.
- `scripts/test-phase1-release-readiness.mjs`: **13/13 passed**.
- `scripts/audit-project-integrity.mjs`: **36 checks passed, 0 errors, 0 warnings**.
- `scripts/check-dependency-lock-integrity.mjs`: passed.
- `scripts/check-release-hygiene.mjs`: **11/11 passed**.
- `scripts/test-vercel-build-repair.mjs`: **9/9 passed**.
- `scripts/test-reported-build-regressions.mjs`: **7/7 passed**.
- `scripts/test-10-phase-baseline.mjs`: **8/8 passed**.
- `scripts/scan-production-safety.mjs`: **21/21 passed**.
- All `scripts/test-*.mjs` regression scripts: **139 passed, 0 failed**, including the new runtime contract test.

## Environment limitation and unresolved gate

The execution environment has Node `v22.16.0`, which is below the project's declared minimum `v22.22.2` and below the pinned `.nvmrc` version `v24.15.0`. The new preflight correctly rejects this runtime. A clean `npm ci --legacy-peer-deps` was attempted but did not complete within the available execution window; no valid installed dependency tree was retained. Consequently, TypeScript, ESLint, and Next.js production build results cannot be claimed from this run.

This is an environment/install blocker, not evidence that those project commands pass or fail. Re-run on Node 24.15.0 with registry access:

```bash
node --version
npm run check:runtime
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run build
```

Then run the full CI workflow and capture its logs. Do not weaken the supported Node version range just to accommodate an older runner.

## Safety boundaries

- No database migration was applied.
- No Pi or GHC financial feature was enabled.
- No secrets or production credentials were added.
- No bulk source-file moves or destructive refactors were performed.
- No Mainnet or global launch readiness is claimed.

## Exit criteria still outstanding

- Clean install succeeds on supported Node runtime.
- Typecheck, lint, and production build pass on that install.
- Full CI including all regression scripts passes.
- Preview/Testnet browser E2E and operator checks are run with configured test credentials and a controlled environment.
