# GreenHaven project truth and release authority

**Current source baseline:** `0.63.25` (2026-10-21)  
**Purpose:** one concise reference for repository truth, release status, migration policy, and the evidence required to change a status.

This document is about the source tree. It is not proof that any remote environment matches it.

## Authority order

1. The checked-out source tree and `package.json` define the current source version.
2. `supabase/migrations/*.sql` defines the canonical migration files on disk.
3. `docs/MIGRATION_CHECKLIST.md` and `VERIFIED_MANIFEST.txt` are generated inventories. Regenerate/check them with `npm run check:migration-inventory`.
4. `docs/PHASE_IMPLEMENTATION_STATUS.md` records source and verification status by product phase.
5. `docs/TESTNET_VERIFICATION_GATE.md` records required operator verification; it does not claim that those checks have run.
6. Dated phase reports are snapshots of work performed at that time. They must not override the current source version or current test evidence.

## Current state

| Area | Status | Evidence / next action |
|---|---|---|
| Source baseline | `0.63.25` | `package.json`, `package-lock.json`, release metadata |
| Repository integrity | Fresh local audit: 36 checks passed, 0 errors, 0 warnings (2026-10-21) | Re-run `npm run audit:project-integrity` after changes |
| Migration inventory | 109 canonical SQL files; 77 `REQUIRED`, 1 `REQUIRES_APPROVAL`, 2 `PROPOSAL`, 29 `REVIEW_REQUIRED` | `npm run check:migration-inventory` |
| Source regression scripts | Phase 1 snapshot: 139/139; Phase 3 focused security contract: 16/16 | Historical suite count is not a fresh full-suite run; build and runtime gates remain separate |
| Clean dependency install | Not verified in the prior workspace | Run with supported Node and registry access |
| TypeScript / ESLint / Next production build | Not verified in the prior workspace | `npm run typecheck`, `npm run lint`, `npm run build` |
| PostgreSQL migration execution and concurrency | Not verified | Disposable PostgreSQL first; record SQL output and review before Testnet |
| Supabase Testnet state | Not verified here | Reconcile remote migration history and run object/behavior checks |
| Pi Browser / provider payments | Not verified here | Run Testnet E2E, reconciliation and failure/retry scenarios |
| Mainnet / production release | **Not certified / not approved by this report** | All release gates and explicit operator approval required |

Phase 3 adds fail-closed durable step-up creation and truthful durable session revocation behavior. A fresh source regression sweep passed 141/141 `scripts/test-*.mjs` files and the focused security contract passed 16/16; live multi-instance behavior remains unverified. Historical Phase 1 test results are not a claim that the full suite was rerun after every later edit.

The 2026-10-21 Phase 7–8 rework also passed the focused product-experience (26/26), architecture-quality (23/23), and new integrated Phase 7–8 regression suite (28/28), alongside Phase 9 (19/19), Phase 10 (18/18), release evidence validation (22/22), project integrity (36 checks), dependency-lock consistency, and JSX safety (710 files). These are local source checks; clean install, TypeScript, lint, production build and runtime/Testnet evidence remain unverified.

## Migration policy

The 109-file count is the current repository inventory, not a list of migrations approved for blind execution and not proof of remote application.

- `REQUIRED` means a candidate for operator review, **not automatic permission to apply**.
- `REQUIRES_APPROVAL` requires recorded product/security approval.
- `PROPOSAL` must remain unapplied without explicit written approval.
- `REVIEW_REQUIRED` requires dependency, sequence, SQL behavior, and target-history review before any Testnet consideration.
- The two proposal files and the approval-required file remain in the canonical directory until remote migration history is reconciled; their classification is not enforced by Supabase CLI. Do not run `supabase db push` while any pending migration is unreviewed or unapproved.
- Validate SQL against a disposable PostgreSQL database first. Reconcile Testnet and Mainnet histories independently. Do not reset remote migration history or bulk-apply this inventory.
- Filename timestamps can be later than the audit date. That is a review signal, not proof of validity, application, or failure.

## Release gate order

1. Supported Node runtime: `npm run check:runtime`.
2. Reproducible install: `npm ci --legacy-peer-deps`.
3. Static quality: `npm run typecheck`, `npm run lint`, `npm run test:safety`.
4. Source and release regressions: `npm run ci:verify` (includes the build and additional source gates; run the specific command and capture the actual result).
5. SQL: disposable PostgreSQL tests, migration dependency/history reconciliation, then individually reviewed Testnet migrations.
6. Runtime: two-user authorization/IDOR, financial isolation, Pi Browser payment success/failure/retry, media privacy, messaging, and multi-instance concurrency.
7. Production: separate Mainnet credentials/configuration, monitoring/rollback readiness, operator sign-off, and a recorded release decision.

A failed, skipped, timed-out, or unavailable command is **not verified**, not a pass. Source tests cannot replace runtime evidence.

## Stabilization programme boundary

This repository also has product phase numbers (including Phase 14 and later). Those are distinct from the 10-phase stabilization programme:

- Phase 1: build and dependency stability.
- Phase 2: project truth, documentation, and migration reconciliation.
- Phase 3 onward: identity/security/privacy; database/migration validation; GHC/Pi financial integrity; media/messaging; product experience; architecture cleanup; operations; Testnet beta/release approval.

Phase 2 does not introduce product features, change financial behavior, apply migrations, or approve deployment.
