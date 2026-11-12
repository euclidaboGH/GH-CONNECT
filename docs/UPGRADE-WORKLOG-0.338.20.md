# GreenHaven upgrade worklog 0.338.20

Date: 2026-11-10

## Run #242 — Pi withdrawal single-entrypoint repair

- Routed the wallet dashboard withdrawal focus action through the dedicated Pi withdrawal sheet.
- Removed the dashboard's direct POST submission path, which did not carry the server-bound withdrawal PIN proof.
- Kept the server-side Testnet request and executor gates fail-closed. This change does not enable payout execution, alter balances, apply migrations, or send Pi.
- Added a static regression guard for the single withdrawal entrypoint.

## Release identity

- Package and lockfile version: `0.338.20`.
- App release identity: `0.338.20`.
- Run #243 exposed stale regression assertions that still required `0.338.19`; these are aligned to the current package/release metadata in the Run #243 repair.

## Runtime verification boundary

- This is source-only verification; it does not substitute for a dependency-backed build or live operator acceptance.
- This source review environment uses Node.js 22.16.0 and does not contain `node_modules`; the project requires Node.js 24.15.0. Accordingly, this worklog does not claim a dependency-backed TypeScript, lint, or Next.js production build pass. Those checks must run on the pinned Node.js 24.15.0 CI runtime.
- Static source checks do not prove provider execution, remote database state, or live Pi Testnet transfer acceptance.

## Acceptance boundary

Static source checks do not prove that a live Pi Testnet withdrawal was accepted or transferred. Confirm the exact `POST /api/economy/earnings/withdrawals` response and separately verify database migration state, operator flags, wallet consent, executor readiness, settlement and recovery before enabling any payout intake.

Production remains NOT APPROVED.

## Run #244 — manifest, release truth and withdrawal-checker hardening

- Regenerated the 199-file migration inventory metadata for `0.338.20`; no SQL files or classifications were changed.
- Strengthened project-truth verification to require deterministic migration inventory synchronization.
- Updated the Phase 1–12 and Phase 12 release snapshots to the current `0.338.20` baseline while preserving historical-fixture labels and production NOT APPROVED status.
- Updated the wallet authorization regression contract to follow the current dedicated Pi withdrawal sheet and its PIN-bound idempotency intent instead of retired dashboard state.
- Added exact Node.js 24.15.0 CI runtime assertions and sanitized Vercel's npm install environment from the obsolete cache-dir aliases.
- Focused verification: project truth 11/11; Phase 1–12 consolidation 24/24; request-boundary follow-up 14/14; Phase 12 release readiness 28/28; release hygiene 13/13; wallet authorization 27/27; migration source manifest 199/199; documentation hygiene PASS; full `npm run verify:static` 57/57 plus trailing wallet authorization contract PASS.
- Node 22.16.0 / no `node_modules` means dependency-backed typecheck, lint and Next.js build are not verified in this environment. The supplied Vercel excerpt omits the actual compiler diagnostic; capture the full build output before claiming the build issue is resolved.
- No migrations, wallet balances, provider transfers, deployment settings or production state were changed. Production remains NOT APPROVED.


## Run #245 — lint contract and account hydration hardening

- Repaired the stale GitHub #195 lint-remediation contract: it now verifies the current dedicated Pi withdrawal sheet and actual callback dependency arrays rather than requiring the retired `onRequestPayout` callback.
- Stabilized the wallet authorization revoke callback with explicit dependencies.
- Identified the Vercel `/api/economy/account` 429 as consistent with the route's durable 12-per-minute mutation throttle; repeated domain-service construction was invoking the idempotent anchor POST without deduplication.
- Added in-flight request sharing, bounded per-tab server-anchor memoization, a short negative cache, an eight-second timeout, explicit credentials/JSON/no-store request policy, strict positive timestamp validation, and an offline fallback. The canonical POST and its fail-closed rate limit remain intact.
- Added `scripts/check-run245-account-hydration.mjs` to `prelint`: 15/15. GitHub #195 lint remediation: 9/9. Project truth: 11/11. Withdrawal single-entrypoint: 6/6. Pi withdrawal consent/identity: 12/12.
- The source environment remains Node.js 22.16.0 without `node_modules`; full dependency-backed ESLint, TypeScript and Next.js build results must come from Node.js 24.15.0 CI.
- No migrations, balances, ledger entries, Pi transfers, production settings, GitHub branches or deployments were changed. Production remains NOT APPROVED.


## Run #246 — withdrawal, PIN recovery and hydration reliability

Fifteen focused upgrades were made from the Run #245 baseline and the supplied Vercel diagnostics:

1. Replaced the payout worker's direct request-table read with an ownership-scoped SECURITY DEFINER lookup RPC.
2. Preserved the payout table's direct-access revocation for `service_role` and all client roles.
3. Limited the payout lookup response to the exact fields required by the Testnet worker.
4. Validated canonical UUID request IDs before invoking the database RPC.
5. Converted Supabase lookup failures into safe retryable 503 responses instead of unhandled 500s.
6. Added sanitized Supabase HTTP/SQLSTATE diagnostics without returning raw database errors or secrets.
7. Added an additive repair migration that reasserts `public` schema usage and the server-only PIN-table grants.
8. Removed direct recovery-table access from the recovery service; recovery status now uses a narrow RPC.
9. Moved recovery setup to a database-enforced insert-only RPC with question-ID/hash validation.
10. Made failed recovery-answer attempts atomic under a row lock.
11. Made PIN replacement, recovery-attempt reset and the 24-hour post-reset cooldown one database transaction.
12. Added strict validation of persisted recovery-answer structure before hashing/comparison.
13. Added a separate durable fail-closed rate limit to PIN-recovery status GET.
14. Added payout-lookup and PIN-recovery RPC probes to withdrawal infrastructure health using synthetic non-user identities.
15. Separated server-confirmed account-anchor cache from profile hints and skipped repeat hydration POSTs only when a prior server-confirmed immutable anchor exists.

- New additive SQL migration: `20261110100001_withdrawal_rpc_acl_and_recovery_atomicity.sql` — REVIEW_REQUIRED, not applied.
- Migration inventory regenerated and synchronized at 200 canonical SQL files; the new migration is explicitly held for review.
- Added `supabase/tests/verify_run246_withdrawal_rpc_acl.sql`, a read-only catalog postflight for the effective service-role/client grants and RLS state.
- Focused Run #246 source contract: 18/18; Run #245 account hydration: 16/16; Pi identity/withdrawal: 10/10; Phase 4 payout execution worker: 21/21; Phase 1–10 pack: 20/20; withdrawal health: 23/23; project truth: 11/11; repository consistency: 6/6; documentation hygiene: PASS; migration source manifest: 200/200; SQL lexical integrity: PASS; full `npm run verify:static`: exit 0.
- No Supabase migration was applied, no payout was executed, no Pi/GHC balance or ledger was modified, and no GitHub/Vercel action or production deployment was performed.
- PostgreSQL execution, target Testnet migration-history reconciliation, Node 24.15.0 dependency-backed lint/typecheck/build, and live Pi Testnet acceptance remain outstanding. Five modified TypeScript files passed syntax transpilation only; full typechecking is not claimed. Production remains NOT APPROVED.

## Run #247 — build failure diagnostics and dependency warning triage

Fifteen safe build/CI improvements were made from the supplied GitHub Actions #247 log and the Run #246 source baseline:

1. Replaced the opaque prebuild command chain with a numbered diagnostic runner.
2. Preserved all 277 pre-existing prebuild checks under `prebuild:checks`.
3. Executes each checker directly with Node.js, without shell evaluation.
4. Labels each check before execution.
5. Reports the exact failing script and its exit status/signal.
6. Validates all prebuild entries use direct Node invocations.
7. Validates every entry has a script target.
8. Confirms every referenced checker exists before execution.
9. Enforces the declared Node engine before running the prebuild gates.
10. Adds a no-execution `--list` / `--dry-run` mode.
11. Adds a focused 15-assertion Run #247 source contract.
12. Registers the contract in `verify:static` and as `check:run247-build-diagnostics`.
13. Removes stale user-level npm `cache-dir` configuration in CI without changing project `.npmrc`.
14. Records npm's version in both CI jobs.
15. Preserves only Next.js trace/diagnostics artifacts for three days when build fails.

Dependency warnings were reviewed but not “fixed” by unsafe package swaps. `pi-backend@0.1.3` brings in deprecated Stellar packages transitively; `eslint-config-next@15.5.26` declares ESLint 7/8/9 peer support; DOMPurify 4.x requires compatibility testing; and native install scripts remain unapproved pending exact script review. See `docs/VERCEL-GITHUB-RUN-247-BUILD-DIAGNOSTICS-AND-DEPENDENCY-WARNINGS-2026-11-10.md`.

The visible Run #247 excerpt does not contain the underlying Next.js compiler diagnostic. The runner now makes prebuild failures attributable, but it does not prove the omitted Next.js failure is fixed. Local dependency installation could not complete because the registry returned `EAI_AGAIN`, and the available runtime was Node 22.16.0 rather than the required Node 24.15.0. Dependency-backed typecheck, lint and production build remain unverified. No migrations, balances, ledger entries, reservations, Pi transfers, GitHub pushes, Vercel deployments or production settings were changed. Production remains NOT APPROVED.


## Run #248 — release-gate contract repair and runner hardening

Fifteen primary improvements were applied after the supplied GitHub Actions #248 failure, with a further cross-repository contract-alignment sweep correcting all existing prebuild-registration assertions:

1. Added a shared parser for the restricted prebuild command manifest.
2. Rejects missing or empty prebuild manifests.
3. Rejects empty entries caused by malformed `&&` chains.
4. Requires direct Node.js invocation for every prebuild entry.
5. Preserves supported Node flags before script paths.
6. Rejects shell metacharacters and command substitution.
7. Rejects path traversal in checker paths.
8. Requires safe `scripts/*.mjs` targets.
9. Confirms every declared checker exists before execution.
10. Updated the runner to use the shared parser without shell execution.
11. Fixed Phase 10 closure checks to inspect `prebuild:checks` rather than the runner-only `prebuild` script.
12. Explicitly verifies the diagnostic runner remains the prebuild entrypoint.
13. Preserved all five release controls in the declared prebuild manifest and static verification.
14. Added a 15-assertion Run #248 regression contract to both verification suites.
15. Updated Vercel's build command to clear injected npm cache-dir environment variables in its own shell, not only during install.

Verification: Phase 10 release closure 16/16; Phase 10 platform acceptance 24/24; Phase 24 final release review PASS; Pass 36 system integrity 8/8; Run #248 focused contract 15/15; Run #247 diagnostic contract 15/15; full `npm run verify:static` exit 0; prebuild manifest dry-run discovers 278 commands, retaining the 277 previous checks. The cross-repository sweep updated 60+ legacy source contracts that were still inspecting the wrapper-only `prebuild` script rather than `prebuild:checks`. The supplied Run #248 error is a stale checker assumption, not missing release gates. Node 24.15.0 full CI and Next.js build remain unverified in the available Node 22.16.0 environment. No dependencies were changed, native scripts approved, migrations applied, financial state changed, or deployment performed. Production remains NOT APPROVED. See `docs/VERCEL-GITHUB-RUN-248-RELEASE-GATE-CONTRACT-REPAIR-2026-11-10.md`.


## Run #249 — wallet recovery contract repair and race hardening

Full run report: `docs/VERCEL-GITHUB-RUN-249-WALLET-RECOVERY-AND-NODE24-CI-2026-11-10.md`.

- Corrected `scripts/check-wallet-security-hardening.mjs`: recovery-answer hashing is checked in the server implementation, while the 24-hour reset cooldown is checked in the atomic SQL migration that actually enforces it.
- Added `scripts/check-run249-wallet-recovery-build-guards.mjs` with focused contracts for salted scrypt, input normalization, constant-time comparison, insert-only setup, bounded/serialized failed attempts, transactional reset, cooldown enforcement, RPC ACLs, CI build diagnostics, and the additive race guard. Registered it in `prebuild:checks` and `verify:static`.
- Added `20261110110001_wallet_recovery_reset_lock_race_guard.sql` (REVIEW_REQUIRED, unapplied). The replacement RPC re-checks the recovery lock under `FOR UPDATE`, locks the PIN row, blocks resets during an existing cooldown, and preserves service-role-only execution.
- Regenerated the migration checklist, verified manifest, source CSV, and Testnet review order: 201 migration files. No migration was applied.
- Added `docs/DEPENDENCY-WARNINGS-RUN249.md` to record the disposition of all supplied dependency/native-script warnings and the safe follow-up required.
- Updated the CI diagnostics artifact action from `actions/upload-artifact@v4` to `@v7`, the current Node 24-compatible release, removing the explicit Node 20 deprecation warning from this workflow. The upstream action documentation confirms v7 runs on Node 24.
- No application dependency versions or native install-script approvals changed. The npm deprecation/install-script warnings are retained as review items rather than hidden with unsafe blanket approvals.
- The supplied Vercel excerpt ends at the generic `npm run build` failure and does not include the Next.js compiler diagnostic. The build failure is therefore not claimed fixed; rerun with the full build log/artifact before changing application code or compiler settings.
- No Pi payment, wallet balance, GHC ledger, payout, escrow, or production state was changed. No GitHub push or Vercel deployment was performed.
