# GH-CONNECT project truth and release authority

**Current source version:** `0.69.3` (confirm `package.json` and `lib/app-release.ts`).
**Latest supplied deployment evidence:** Vercel build for branch `testnet`, commit `a04ebff`, 2026-10-22.

This document describes the checked-in source and the latest evidence supplied to the maintainer. It does not prove that a remote environment matches the source. The migration inventory does not prove that any migration is applied to a remote database; production is not certified / not approved. When this document and live CI differ, capture the latest run and update this document.

## Authority order

1. The exact checked-out branch/commit and its `package.json` define source truth.
2. The canonical files under `supabase/migrations/` define the migration inventory on disk.
3. `docs/MIGRATION_CHECKLIST.md` and `VERIFIED_MANIFEST.txt` are intended to be generated file inventories; the current inventory check is blocked by duplicate migration version prefixes (see below).
4. This document records the latest known build/release state.
5. Dated reports under `docs/archive/` are historical records only; they must not be treated as current build, migration, or release approval.

## Current verification state

| Gate | Latest known result | Required next action |
|---|---|---|
| Vercel source checkout | Branch `testnet`, commit `a04ebff` | Confirm fixes are committed to this exact branch/commit. |
| Dependency installation | `npm ci --legacy-peer-deps` completed in supplied Vercel log; npm reported 19 vulnerabilities and package deprecation/install-script warnings | Review `npm audit` output and install-script provenance; do not use `npm audit fix --force` blindly. |
| JSX safety | Passed: 727 files scanned | Re-run in current CI. |
| Next.js compilation | Passed: optimized compilation completed | Compilation alone is not a successful build. |
| TypeScript / production build | **FAILED**: `contexts/ghc-context.tsx:2450`, `domains.identity` is used before `domains` declaration | Move the existing `getDomainState` and `domains` initialization above callbacks that reference it in the exact branch source; preserve factory options and dependency arrays; rerun full CI. |
| Full lint and typecheck | Not passed by the supplied run; build stops during type checking | Run the project's configured checks after the fix. |
| Migration inventory | **CHECK BLOCKED**: 111 SQL files; classifications 79 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 29 REVIEW_REQUIRED. Duplicate version prefixes `202610210001` and `202610210002` block normal inventory validation | Resolve duplicate migration identifiers through reviewed, migration-history-safe remediation; do not rename applied migrations blindly. |
| Supabase migrations and live database | Not verified by this build log | Reconcile remote migration history and use disposable PostgreSQL/Testnet gates before applying changes. |
| Pi Browser, payment, payout and multi-user runtime | Not verified by this build log | Perform dedicated Testnet and provider verification with evidence. |
| Production/Mainnet release | **Not approved** | Require all release gates and explicit operator sign-off. |

## Required verification sequence

1. Confirm the intended commit and supported Node runtime (`npm run check:runtime`).
2. Install from the lockfile (`npm ci --legacy-peer-deps`).
3. Run `npm run typecheck`, `npm run lint`, and `npm run test:safety`.
4. Run targeted regressions for changed domains, then `npm run ci:verify` and `npm run build`.
5. Resolve the duplicate migration-version inventory blocker, then run migration inventory and release checks (`npm run check:migration-inventory`, `npm run check:migration-release-readiness`, and `npm run check:project-truth`).
6. Validate migration behavior on disposable PostgreSQL, then reconcile Testnet schema and migration history before any remote apply.
7. Verify two-user authorization/IDOR, financial isolation, Pi Browser success/failure/retry, media privacy, messaging, and concurrency in Testnet.
8. Promote only with separate Mainnet configuration, monitoring/rollback readiness, recorded evidence, and operator approval.

A failed, skipped, timed-out, or unavailable check is **not verified**. Source tests do not replace database, provider, or runtime evidence.

## Migration policy

Migration classifications are review metadata, not permission for automatic application. `REQUIRED` still requires target-history reconciliation; `REQUIRES_APPROVAL` needs explicit approval; `PROPOSAL` must not be applied without written approval; `REVIEW_REQUIRED` requires dependency and SQL review. Never bulk-apply the inventory or reset remote migration history to make it match the repository.

## Historical documentation

Older phase reports and one-off repair logs have been moved to `docs/archive/` to keep the active documentation focused. They may contain source versions, counts, and test results that were true only at the time they were written. Use current CI output and this document for release decisions.
