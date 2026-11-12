# Run #249 — wallet recovery, CI warning, and release-gate repair

**Source:** `GREENHAVEN-0.338.20-RUN248-RELEASE-GATE-REPAIR-15-UPGRADES.zip`  
**Project version:** `0.338.20` (unchanged)  
**Scope:** 15 targeted upgrades; no deploy, push, or database application.

## 15 upgrades

1. Corrected the wallet-security checker to inspect the SQL migration for the 24-hour reset cooldown rather than searching for a database field in the TypeScript service.
2. Kept the production answer KDF requirement explicit: scrypt, not a fast general-purpose digest.
3. Added a regression contract for independent cryptographically random salts per answer.
4. Added regression coverage for Unicode-aware normalization and strict answer-length bounds.
5. Added regression coverage for stored question IDs, salt encodings, and hash encodings.
6. Added regression coverage for exactly three distinct recovery questions and usable answers.
7. Preserved database-enforced insert-only recovery setup.
8. Added regression coverage for database-side validation of the three hashed answer records.
9. Preserved row-locked, bounded failed-attempt accounting.
10. Added an additive SQL race guard that re-checks recovery lock state while holding the recovery row lock.
11. The new reset RPC locks the PIN row before changing PIN state.
12. The new reset RPC refuses a reset while the prior 24-hour cooldown is still active, preventing cooldown extension through repeated resets.
13. PIN replacement and recovery-counter reset remain in one database transaction.
14. Preserved service-role-only execution for the reset RPC and regenerated the canonical 201-file migration review inventory; the new migration remains REVIEW_REQUIRED and unapplied.
15. Updated `actions/upload-artifact` from v4 to v7, the Node 24-compatible upstream action, removing the workflow's Node 20 deprecation warning; aligned the existing CI regression checker.

## Regression coverage

- Wallet security hardening: **12/12**.
- Run #246 withdrawal/recovery reliability: **18/18**.
- Run #247 build diagnostics: **15/15**.
- New Run #249 wallet recovery/build contracts: **24/24**.
- Complete `npm run verify:static`: **PASS**.
- SQL lexical integrity: **201 migrations PASS**.
- Migration inventory `--check`: **PASS**, 201 files.
- Prebuild diagnostic dry-run: **279 checks discovered**.
- CI workflow YAML parse: **PASS**.

## Build status and limitations

The public GitHub job page exposes only the generic production-build exit-code annotation and the Node 20 artifact-action warning; the underlying Next.js compiler output is behind GitHub sign-in and is not present in the supplied excerpt. Therefore the actual `npm run build` failure is **not claimed fixed**. The workflow already preserves `.next/trace` and `.next/diagnostics` on failure; the updated Node 24 artifact action makes those diagnostics upload through a current action. Inspect the next failed build artifact or provide the complete Vercel `next build` output before making speculative application/compiler changes.

The local environment is Node 22.16.0, while the project requires Node 24.15.0, and dependencies are not installed here. Static verification ran successfully, but full `npm run prebuild`, TypeScript, ESLint, and `next build` were not executed in the required environment.

Dependency warnings are documented in `docs/DEPENDENCY-WARNINGS-RUN249.md`. No application dependency or lockfile was upgraded, and no native install script was approved without a dependency/runtime audit.

## Safety boundary

- New migration: `20261110110001_wallet_recovery_reset_lock_race_guard.sql` — **REVIEW_REQUIRED; not applied**.
- No Supabase `db push`, live schema mutation, Pi transfer, payout execution, wallet balance, GHC ledger, or escrow change.
- No GitHub push or Vercel deployment.
- Production remains **NOT APPROVED** pending full build, Node 24 checks, database migration reconciliation, and independent Testnet acceptance.
