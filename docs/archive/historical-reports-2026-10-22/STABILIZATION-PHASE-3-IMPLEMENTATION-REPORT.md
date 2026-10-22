> HISTORICAL RECORD — not current release status. Check `docs/PROJECT_TRUTH.md` and current CI evidence before relying on this report.

---

# GreenHaven Stabilization Phase 3 — Identity, Security, Privacy & Migration Reconciliation

**Source baseline:** `0.63.25`  
**Worktree baseline:** Phase 2 project archive  
**Status:** expanded source hardening and focused regression checks completed; clean install, typecheck, lint, production build, PostgreSQL, and live Testnet checks remain unverified.

## Changes implemented

### 1. Fail-closed step-up persistence

- Production step-up creation now rejects when durable storage is not configured.
- Production step-up creation now rejects when the database insert fails, rather than granting an authorization proof that exists only in one server process.
- Non-production may still use the documented in-memory fallback for local development, with a warning.
- The API returns `503 STEP_UP_DURABILITY_UNAVAILABLE` for this specific dependency outage.

### 2. Session revocation truthfulness

- Session token revocation now persists to configured durable storage before changing the in-memory cache.
- Owner-scoped session revocation likewise persists before changing local cache and throws a controlled failure if the durable update fails.
- Logout no longer reports success when a valid session could not be durably revoked; it clears the browser cookie and returns a service-unavailable response instead.
- These changes do not alter the Pi identity authority or replace server-side session validation.

### 3. Cross-instance step-up validation and revocation

- `findValidStepUp` now treats the durable store as authoritative whenever configured and checks it before trusting any process-local cached proof.
- A missing/revoked/expired row or database outage fails closed; the in-memory cache cannot resurrect an old proof during a database outage.
- Step-up revocation now returns an explicit success/failure result and updates the local cache only after the durable update succeeds.
- Logout, single-session revoke, and revoke-others return `503` rather than claiming completion if associated step-up revocation cannot be confirmed.

### 4. Durable session revocation ordering

- Same-device session de-duplication now waits for durable revocation before mutating the local cache or issuing the replacement session. Failed persistence aborts the new session flow with `SESSION_REVOCATION_UNAVAILABLE`.
- `revokeAllSessionsForUser` now performs the durable bulk update before changing process-local cache state and throws a controlled error when the shared store does not confirm the update.
- Session revocation failures are surfaced as service unavailable by the individual session route.

### 5. Migration inventory reconciled conservatively

- Canonical inventory remains **107 `.sql` migration files**; the additional non-SQL file in the directory is not counted as a migration.
- Updated classification: **77 REQUIRED / 1 REQUIRES_APPROVAL / 2 PROPOSAL / 27 REVIEW_REQUIRED**.
- Four previously under-classified future-dated files were moved to `REVIEW_REQUIRED`: `20261022_gh_content_rewards.sql`, `20261023_gh_profile_content_library.sql`, `202610250002_gh_post_restore_owner_window.sql`, and `202610250003_gh_lifecycle_payout_quality_foundation.sql`.
- All 15 migration filenames dated after the 2026-10-21 audit baseline are now in the review-required set.
- A deeper filename-version audit found two duplicate Supabase migration version prefixes: `202610170001_ghpv_settlement_engine.sql` / `202610170002_match_signals_durable.sql`, and `202610180012_gh_engagement_rosters.sql` / `202610170003_ghpv_calibration_bounds.sql`. The release-readiness script now fails closed on duplicate numeric prefixes; no filenames were changed because remote Testnet/Mainnet history is not available.
- Regenerated `docs/MIGRATION_CHECKLIST.md` and `VERIFIED_MANIFEST.txt`; added an explicit warning that Supabase CLI does not enforce these documentation classifications.
- No SQL migration was deleted, renamed, or applied. This is intentional: remote Testnet/Mainnet migration history and schema were not accessible, so moving even a proposal out of the canonical directory could create a local/remote history mismatch. The two proposal files and one approval-required file remain a known hold until the operator reconciles remote histories. Do not run `supabase db push` while any pending migration is unreviewed or unapproved.

## Verification evidence from this worktree

- Full source regression sweep: **141/141 `scripts/test-*.mjs` files passed** after the additional hardening.
- `scripts/test-stabilization-phase3-security.mjs`: **25/25 passed**.
- `scripts/check-project-truth.mjs`: **14/14 passed**.
- `scripts/audit-project-integrity.mjs`: **36 passed, 0 errors, 0 warnings**.
- `scripts/scan-production-safety.mjs`: **21/21 passed**.
- `scripts/check-release-hygiene.mjs`: **11/11 passed**.
- Session management, session replay, and auth lifecycle smoke suites passed.
- `scripts/generate-migration-inventory.mjs --check`: inventory files synchronized.
- `scripts/check-migration-release-readiness.mjs`: **BLOCKED as intended** by the two duplicate migration version prefixes; also reports 15 future-dated migrations that require review. This is a release blocker, not a clean readiness result.
- `node --check` on the modified JavaScript test and migration-inventory scripts: passed.

These are source/static checks only. A direct `tsc --noEmit` attempt cannot be considered a valid project typecheck because `node_modules` is absent (for example, `next/server` and Node type declarations are unavailable); the attempt exits with missing dependency/type errors. The pinned Node runtime is 24.15.0, while this environment provides Node 22.16.0, below the repository minimum of 22.22.2. Clean install, typecheck, lint, production build, PostgreSQL validity, live database revocation behavior, and cross-instance session behavior therefore remain unverified.

## Required next checks

1. Use the supported Node runtime and complete `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, and `npm run build`.
2. Add/execute runtime tests against mocked PostgREST and two app instances for durable session and step-up insert/update failure, including cache invalidation and multi-instance revocation behavior.
3. Run migrations against a disposable PostgreSQL database; verify RLS, grants, RPC ownership, idempotency, ordering, and rollback behavior.
4. Obtain `supabase migration list` output separately for Testnet and Mainnet and compare each target with the 107-file local inventory. Do not reset remote migration history or bulk-apply files.
5. Resolve the two duplicate numeric migration prefixes only after both remote histories confirm whether either filename/version has been applied. Record the chosen migration-history-safe remediation before renaming anything.
6. After history reconciliation, decide whether the two proposal SQL files have ever been applied. Only then move unapproved proposals out of the canonical executable migration folder if remote history proves that action safe.
7. Run two-user authorization/IDOR, session revocation, step-up, account export privacy, media privacy, and Pi Browser E2E on Testnet.

## Release decision

**Not production certified. No migrations were applied and no financial feature was enabled.** Continue with verification and targeted hardening; do not interpret static green checks as runtime evidence.

## Migration identity-collision follow-up (2026-10-21)

- Added `scripts/reconcile-remote-migration-histories.mjs`, a read-only report generator that compares saved `supabase migration list` outputs for Testnet and Mainnet against local filename prefixes independently. It does not connect to databases or mutate migration files.
- Added `scripts/test-migration-history-reconciler.mjs`; synthetic fixtures pass and verify duplicate-version blocking, environment-specific version comparisons, remote-only versions, and the important limitation that version matches do not verify SQL content.
- Added `docs/REMOTE_MIGRATION_RECONCILIATION.md` with safe capture commands and resolution rules.
- The two duplicate local versions remain unresolved by design: `20261017` maps to settlement-engine and match-signals SQL; `20261018` maps to engagement-rosters and GHPV calibration-bounds SQL. Their feature purposes/dependencies differ, so choosing a rename based on filenames alone would be unsafe.
- Remote Testnet/Mainnet outputs have not been supplied or accessed. Therefore no remote comparison is claimed, no migration files were renamed/moved/applied/repaired, and deployment remains blocked. SQL syntax/runtime validation and live Phase 3 security gates remain outstanding.

## Migration content review follow-up (2026-10-21)

- Added `docs/FUTURE_MIGRATION_CONTENT_AUDIT.md` reviewing both duplicate-version pairs and all 15 future-dated SQL files against current routes/stores/tests.
- Confirmed the two `20261017` migrations and two `20261018` migrations have distinct responsibilities; none should be deleted as a duplicate. Version renaming remains blocked pending separate Testnet/Mainnet history evidence.
- Fixed a source-level story privacy gap in `202610240006_gh_story_reactions.sql`: the reaction RPC now independently enforces the story audience, preventing a known story ID from bypassing follower/friend visibility. `matches-only` and `private` remain owner-only until canonical match authorization is available. Added regression checks; `scripts/test-social-visibility.mjs` now passes 14/14.
- Updated `VERIFIED_MANIFEST.txt` after the SQL change. Future migration content is useful in general but remains deployment-gated; source checks do not establish PostgreSQL syntax/runtime or remote state.
- `scripts/audit-profile-production.mjs` currently reports 83/87 due four profile UI/source expectation failures documented in the content audit; these are not treated as migration-validation evidence.
