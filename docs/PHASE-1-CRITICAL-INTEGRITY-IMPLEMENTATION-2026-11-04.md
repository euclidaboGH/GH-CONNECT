# GreenHaven Phase 1 — Critical Integrity Implementation

**Baseline:** `GREENHAVEN-0.312.0-GITHUB-41818259640-LINT-TYPESCRIPT-HARDENING.zip`  
**Implementation snapshot:** 4 November 2026  
**Scope:** source-level integrity and reliability corrections only. No database migration, financial flag change, or deployment configuration change was made.

## Implemented

1. **Curation outage feedback:** `CURATION_INTELLIGENCE_UNAVAILABLE` and `CURATION_REVIEW_REQUIRED` now map to safe, actionable user-facing copy. The feed card no longer displays the raw internal code for this failure.
2. **Curation snapshot integrity:** weighted curation reads `calculated_at` and rejects missing, future-dated, or older-than-24-hour intelligence snapshots. Durable intelligence remains mandatory; no client/formula fallback was introduced.
3. **Bounded curation dependencies:** reputation refresh RPC, intelligence snapshot, and curator calibration reads now have eight-second request timeouts. Failures continue to fail closed.
4. **Marketplace retry safety:** cart line reservation idempotency keys are retained across retries and cleared only after the checkout flow completes. This prevents a lost response from generating a fresh key for the same in-progress cart line.
5. **Marketplace timeout truthfulness:** timeout copy no longer claims that no charge was confirmed when earlier line orders may have been created or paid; it directs users to inspect Orders before retrying.
6. **Marketplace privacy/UX:** the cart no longer exposes a truncated internal seller ID when a seller display name is unavailable.
7. **Static contract corrections:** wallet rail assertions now validate the actual accessible toggle-group pattern (`role="group"` and `aria-pressed`), and the withdrawal journey assertion accepts the current `useCallback(async ...)` implementation. Product behavior was not weakened.
8. **Regression coverage:** phase-specific checks cover freshness, timeouts, safe curation error mapping, and retry-stable cart idempotency.

## Verification results

- `npm run verify:static`: **PASS** (exit 0).
- `npm run verify:production`: **250 PASS / 0 FAIL** (exit 0).
- Targeted wallet dual-asset contract: **11/11 PASS**.
- Targeted wallet withdrawal journey: **11/11 PASS**.
- Targeted marketplace cart contract: **14/14 PASS**.
- Curation intelligence readiness: **9/9 PASS**.
- Curation reliability: **14/14 PASS**.
- Phase 5 reliability: **14/14 PASS**.

## Not yet verified / intentionally not changed

- The execution container has Node `v22.16.0`; this repository requires Node `^24.15.0`. Production verification itself reports `SOURCE_CHECKS_PASS — BUILD_AND_OPERATOR_VERIFICATION_STILL_REQUIRED`.
- Dependencies are not installed in this environment. TypeScript, ESLint, and Next production build have not been run here.
- Next.js package/lockfile security patching was researched but not applied because the environment could not reach the npm registry and cannot regenerate/verify the lockfile. Do not hand-edit lockfile integrity data. Complete this on Node 24 with registry access.
- No live Testnet Supabase migration state, curation RPC response, or snapshot row was available. The runtime cause of the previously observed curation outage is therefore not claimed as fixed; this phase improves diagnostics, stale-snapshot rejection, and bounded failure behavior. Reconcile remote migration history before any migration execution.
- Marketplace multi-order batch settlement, multiple Pi-order completion, durable checkout session recovery, and atomic cross-rail checkout remain larger Phase 3 commerce-integrity work. Retry-stable keys reduce duplicate reservation risk but do not make the whole cart an atomic transaction.
- No Vercel environment variables, payment flags, balances, or production/Testnet data were changed.

## Release posture

**Phase 1 source changes implemented; build and operator gates remain open.** This archive is suitable for controlled review and Node 24 CI validation, not a declaration of Mainnet readiness. Run the full CI workflow under Node 24.15.0, inspect Testnet logs and migration state, then test curation and marketplace retries with non-production accounts before promotion.
