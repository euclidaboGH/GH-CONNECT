> HISTORICAL RECORD — not current release status. Check `docs/PROJECT_TRUTH.md` and current CI evidence before relying on this report.

---

# Phase 2 — Remaining verification gates

## Local/source checks

```bash
npm run check:runtime
npm run check:project-truth
npm run test:project-truth
npm run check:migration-inventory
npm run check:migration-release-readiness
npm run audit:project-integrity
npm run check:dependency-lock-integrity
```

Run the repository's `scripts/test-*.mjs` suite after changes and retain the actual output. A static pass is not proof that TypeScript compiles or Next.js builds.

## Supported-runtime checks

Use Node 24.15.0 or later in the supported 24.x line, then run:

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run build
npm run ci:verify
```

If a command times out or cannot reach the registry, record it as **NOT VERIFIED**. Do not bypass the lockfile verifier, silence type/lint errors, or use build-ignore flags.

## Database and operator checks

1. Use a disposable PostgreSQL database to validate migration syntax, dependency order, grants/RLS, and critical ledger/payment concurrency.
2. Compare local migration files against the actual Supabase Testnet migration history and schema. Do not infer remote application from filenames or the generated manifest.
3. Review `REQUIRES_APPROVAL`, `PROPOSAL`, and `REVIEW_REQUIRED` migrations separately. `REQUIRED` is a review candidate, not blanket approval.
4. On Testnet, run two-account IDOR and financial-isolation tests, Pi Browser payment success/failure/retry/reconciliation, media privacy, messaging, and multi-instance durability checks.
5. Keep financial/provider flags disabled until their exact evidence gates pass. Do not promote to Mainnet based on source tests alone.
