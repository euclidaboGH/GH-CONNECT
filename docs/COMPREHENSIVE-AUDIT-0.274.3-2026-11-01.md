# GH-CONNECT 0.274.3 — Comprehensive Source, Migration, Security and Release Audit

**Audit date:** 2026-11-01  
**Source archive:** `GH-CONNECT-0.274.3-NOTIFICATION-RPC-PRIVILEGE-HARDEN-2026-11-01.zip`  
**Release decision:** **NOT APPROVED for production** — source-only checks cannot establish deployed database state, live provider behavior, or supported-runtime build success.

## Scope and method

The audit covered the complete repository snapshot: canonical migration inventory and manifest; every canonical migration file's contents; non-migration SQL assets; current release-truth documentation; identity/session, media upload/finalization, social visibility, messaging, GHC transfer, reward, withdrawal, payment recovery, and marketplace order/payout source contracts. Existing focused repository checkers were executed rather than replaced with weaker approximations.

This is a source/static audit. No credentials or live Supabase connection were available, and no database migrations were applied. SQL was read and structurally scanned, but a live PostgreSQL parser/runtime execution was not available in this environment.

## Migration inventory and duplicate audit

- Canonical `supabase/migrations/` files: **175**.
- SQL files across the entire repository: **187** (175 canonical migrations + 12 operator/validation/install/reset SQL assets).
- Canonical migration contents inspected: **1,273,481 bytes / 27,847 lines**.
- Duplicate 14-digit migration timestamps: **0**.
- Duplicate migration suffixes: **0**.
- Byte-identical migration files (SHA-256): **0**.
- Canonical migration source manifest: **175/175 synchronized**.
- Generated migration checklist and `VERIFIED_MANIFEST.txt`: regenerated from the canonical migration directory and rechecked successfully.
- A per-file SHA-256 and structural inventory is in `audit/MIGRATION-CONTENT-SHA256-0.274.3.csv`.

The 12 other SQL assets are not part of the canonical migration chain. They include operator probes, validation scripts, an install artifact, and a database reset script. `supabase/RESET-GREENHAVEN-DATABASE.sql` is explicitly destructive and must only be run when an intentional rebuild has been approved.

## Confirmed issue fixed: stale canonical installer

`supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql` identified itself as the canonical installer for version `0.70.3`, and its embedded source markers covered only **132** migrations. It omitted **43** of the 175 current migrations, including later identity, media, cashback, earnings/payout, treasury, marketplace, community, and notification changes. Running it as a current clean installer would create an incomplete schema.

The original generated body is retained for forensic comparison, but a prominent `DEPRECATED / STALE — DO NOT EXECUTE` banner was added. The current README and source-of-truth documents now warn against using it. Do not regenerate it into a bulk installer without a deliberate design review: the canonical migration directory contains proposal/review-required entries and must never be blindly applied wholesale.

## Confirmed documentation drift fixed

The current `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` contained stale package versions and a 172-migration count, while package metadata was `0.274.3` and the canonical directory contained 175 migrations. README also showed the old migration count. Current metadata was synchronized, and the canonical migration inventory and verified manifest were regenerated. Historical phase notes that document earlier releases were retained as history rather than rewritten as if they described this release.

## Security and workflow contracts

Focused source-level check programs passed for the following areas:

- Canonical identity resolution, account-switch identity precedence, session-derived profile identity, and identity RPC contracts.
- Media upload body bounds, authentication-before-body parsing, owner/path binding, storage-object metadata verification, immutable upload sessions/assets, and upload finalization identity.
- Social/feed/profile contracts and community membership gates.
- Messaging body limits, session-derived sender identity, owned-media attachment checks, cursor validation, rate limits, and durable message hydration.
- GHC wallet transfer integrity, request idempotency, transfer RPC ACLs, bounded financial request bodies, reward contracts/adapters, withdrawal settlement boundaries, and financial reconciliation.
- Marketplace payment binding, durable order mapping, payment recovery, RPC transport, seller net proceeds, immutable adjustment/event journals, and operational financial workflows.
- Notification ordering and service-role-only notification RPC execution grants.
- Database contract source, RLS coverage, SECURITY DEFINER/search-path checks, and migration source manifest.

`npm run verify:static` completed successfully after the documentation and migration inventory corrections. The focused checks executed separately also passed. These results establish source contracts only; they do not prove correct deployed privileges or actual concurrent transaction behavior in a live PostgreSQL instance.

## Migration risk and ordering

The migration readiness checker passes its static checks and explicitly warns that filename order does not prove applied status. Inventory classifications currently include **115 REQUIRED**, **1 REQUIRES_APPROVAL**, **2 PROPOSAL**, and **57 REVIEW_REQUIRED** entries. “REQUIRED” means candidate for operator review, not permission to apply automatically.

Before applying any migration:

1. Obtain and preserve the target project's migration history and schema state.
2. Reconcile every pending migration with that history; investigate already-applied but unrecorded migrations before proceeding.
3. Review all `REVIEW_REQUIRED`, `REQUIRES_APPROVAL`, and `PROPOSAL` files individually.
4. Test schema changes, RPC grants, RLS, rollback behavior, idempotency and race conditions on a disposable PostgreSQL instance, then on Testnet with evidence.
5. Keep Mainnet promotion separately approved. Do not run `supabase db push` against a target with unresolved pending entries.

Static coverage reports 137 executable application table names with explicit RLS enablement; 124 have policy definitions and 13 are explicitly allowlisted for operator/service-role review. The SECURITY DEFINER checker reports 368 audited declarations with a hardened search path and PUBLIC execute revoke. Effective grants, overloads, object ownership, and deployed catalog state still require live database checks.

## Runtime/build boundary

This environment reports Node `v22.16.0`; `.nvmrc` and `package.json` require Node `24.15.0` / `^24.15.0`. `node_modules` is absent. Therefore locked dependency installation, TypeScript, ESLint, and the Next.js production build were **not run** here and must not be represented as passing. Use the pinned Node 24 runtime and the locked install before any release decision.

## Phase 1 follow-up — Pi authentication body streaming hardening

A post-audit review found that `POST /api/auth/pi` checked its 16 KiB body limit only after `request.text()` had buffered the full request. This was corrected by switching to the shared `readBoundedJson` streaming parser, which cancels oversized streams immediately. Added `scripts/check-pi-auth-bounded-json.mjs` and registered it in `verify:static`. The focused checker passes 8/8 and bounded JSON runtime tests pass 9/9. Full details and the remaining validation gates are in `docs/PHASE-1-AUTH-SESSION-MEDIA-HARDENING-2026-11-01.md`.

## Remaining blockers

- Live Testnet migration history and actual schema/grants/RLS catalog have not been inspected in this audit.
- No two-user live tests have demonstrated privacy/visibility boundaries across public, followers, mutuals, private, blocked, and community-only content.
- No live storage tests have proven private media authorization and signed URL refresh against the deployed bucket.
- No live concurrency tests have established transfer/reward/withdrawal/payout idempotency and balance conservation under races.
- No live payment-provider receipt/recovery evidence or end-to-end marketplace settlement evidence was gathered.
- Supported Node 24 locked install, typecheck, lint, and production build remain pending.

**Conclusion:** repository migration codes and manifest have no duplicate timestamps, duplicate suffixes, or byte-identical canonical migration files. Source-level security and workflow checks pass. The stale 132-migration installer and current-document metadata drift were corrected. The project is not release-approved until runtime/build, disposable database, and live Testnet verification gates are completed.

## Phase 2 execution update — 2026-11-01

Phase 2 hardened two confirmed correctness defects without changing migrations or financial policy:

1. The GHC transfer RPC response mapper now validates both ledger legs against the exact requested sender, recipient, amount, kind, posted status, and reference before reporting success.
2. Durable messaging no longer reports a successful send when a configured database insert failed or did not return a persisted row; the existing idempotent retry lookup remains available before failure is returned.

Regression checks added: `check-phase2-transfer-rpc-result-integrity.mjs` (10/10) and `check-phase2-messaging-durable-write.mjs` (5/5), both registered in `verify:static`. The complete `npm run verify:static` suite passed. Node 24 install/typecheck/lint/build and live Supabase/Pi Testnet verification remain outstanding; see `PHASE-2-FINANCIAL-AND-MESSAGING-INTEGRITY-2026-11-01.md`.

## Phase 3 completion — wallet reconciliation and release integrity

Phase 3 fixed three source-level correctness gaps: the presentation wallet seam no longer claims reconciliation success for unknown/error states or invents missing pending/ledger values; the authoritative wallet snapshot now requires exact account identity, all numeric fields including `ledgerBalance`, and a valid server timestamp; and transfer RPC debit/credit legs must have distinct transaction IDs. Added 14 wallet-specific regression checks and extended transfer response checks to 11. `npm run verify:static`, dependency lock integrity, migration cleanliness (175 unique canonical migrations), migration manifest (175/175), and release hygiene (11/11) passed. See `PHASE-3-INTEGRATION-AND-RELEASE-READINESS-2026-11-01.md`. Supported-runtime install, typecheck, lint, build, and live Supabase/Pi Testnet evidence remain outstanding because the available runtime is Node 22.16.0 and required npm artifacts were not cached.


### Consolidated migration document added during five-phase Phase 1

The repository now also contains `supabase/GH-CONNECT-CANONICAL-MIGRATION-BUNDLE-0.274.3.sql`, a byte-for-byte synchronized, one-document review bundle of all **175 individual canonical migrations**, with a source filename, classification, byte count and SHA-256 for each. `scripts/check-migration-master-bundle.mjs` regenerates the expected bundle from the canonical source directory and checks exact equality. This is a review/archival artifact only, not an executable monolithic installer. At the time of this follow-up, the repository contains 188 `.sql` files total: 175 canonical migration sources, 12 pre-existing operator/validation/install/reset assets, and this one consolidated bundle. The number of canonical migrations remains exactly 175. Historical labels such as software versions `0.184.0` and `0.187.0` are not migration counts.


## Phase 3 source-count addendum — 2026-11-01

The earlier audit snapshot above recorded 175 canonical migrations. Phase 3 adds the reviewed-source candidate `20261101170001_gh_story_match_audience_support.sql`; the current canonical inventory is therefore **176 migrations**, classified as REQUIRED 115, REQUIRES_APPROVAL 1, PROPOSAL 2, and REVIEW_REQUIRED 58. The current one-document review bundle, `MIGRATION-SOURCE-MANIFEST.csv`, `VERIFIED_MANIFEST.txt`, and `docs/MIGRATION_CHECKLIST.md` are synchronized to 176 sources. The repository now contains 189 `.sql` files total: 176 canonical migration files, 12 operator/validation/install/reset assets, and the one consolidated review bundle. The legacy installer remains stale and must not be executed. The new story-visibility migration is REVIEW_REQUIRED and must be tested against a disposable PostgreSQL database and the target migration history before application.
