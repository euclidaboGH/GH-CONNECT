# GH-CONNECT Phase 1 — Repository and deployment harmonization

**Package:** 0.60.9 (Phase 1 source changes)
**Scope:** repository CI, release hygiene, migration inventory safety, and pre-deployment readiness.

## Implemented in this phase

1. GitHub Actions uses Node.js 24.15.0, aligned with `.nvmrc` and `package.json` engines.
2. Static CI runs all `scripts/test-*.mjs` scripts rather than only a small subset.
3. CI adds release-hygiene validation and the migration inventory report.
4. Workflow concurrency cancels superseded runs on the same ref.
5. `scripts/check-release-hygiene.mjs` checks package/lockfile/release notice version agreement, Node engine alignment, migration inventory presence and duplicate names, accidental local `.env*` files, and CI workflow presence.
6. `SAFE_TO_PUSH.md` is updated with the 0.60.8 release gates and explicitly states that CI does not apply remote migrations.

## Local verification in this workspace

- All `scripts/test-*.mjs` scripts: passed (0 failures).
- Production safety scan: 21/21.
- JSX safety scan: passed (640 files).
- Release hygiene: 8/8.
- Notification attention: 17/17.
- Migration inventory: 86 SQL files found by the current checker; inventory is not proof of remote application state.

## Not verified here

Dependencies were absent at the start. `npm ci --legacy-peer-deps` was attempted but did not return within the tool execution window. Therefore TypeScript, ESLint, and Next.js production build results are not claimed. No SQL was executed against Supabase. No GitHub push, Vercel deployment, Pi Browser E2E, or remote DB migration occurred.

## Two-phase release plan

### Phase 1 — repository hardening (this package)

Complete static regression execution, consistent runtime pinning, release metadata checks, and non-mutating migration inventory. Preserve separate mainnet/testnet projects and keep deployment/migration steps manual until the actual migration history is reconciled.

### Phase 2 — controlled integration verification

1. Install dependencies on Node 24.15.0 and require typecheck, lint, full CI, and production build to pass.
2. Reconcile migration history against the Testnet Supabase project; review timestamp ordering and approval/proposal classifications. Back up and apply only approved, missing migrations to Testnet.
3. Test Pi authentication, U2A approve/complete and idempotency, rewarded-ad verification, membership fulfillment, self-curation exclusion from reward/calibration, reputation events, notification/messaging persistence, rate limits, RLS/RPC grants, and concurrent duplicate requests.
4. Confirm Vercel Preview uses only Testnet credentials/origin and Pi sandbox mode; confirm Production uses only Mainnet credentials/origin and Pi production mode.
5. Promote to Mainnet only after a separate reviewed migration plan, backup/rollback plan, and explicit operator approval.

Phase 2 is not marked complete by static tests alone; it requires access to the actual Testnet project and Pi Browser test accounts.
