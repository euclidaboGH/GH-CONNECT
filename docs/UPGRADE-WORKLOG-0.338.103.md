# GreenHaven upgrade worklog — 0.338.103 RUN376

**Date:** 2026-11-19  
**Baseline:** `GREENHAVEN-0_338_102-RUN373-RUN375-PHASE1-3-SECURITY-HARDENING-2026-11-19.zip`  
**Package:** `gh-connect@0.338.103`  
**Scope:** Phase 3 continuation; economy, curation, withdrawal, rewards and shared emission pipeline hardening.

## Coordinated release implementation steps

1. Re-opened and verified the exact 0.338.102 source archive as the implementation baseline.
2. Mapped the daily-claim, activity-emission, reward, curation and withdrawal call chains before changing behavior.
3. Corrected GHPV final normalized reviewer influence and duplicate reviewer quorum handling.
4. Added bounded snapshot validation and fail-closed durable calibration loading.
5. Added durable per-content settlement rate limiting.
6. Removed the database-backed population fallback to a synthetic one-user economy.
7. Designed the shared atomic global-demand allocator for daily claims and activity emission.
8. Wired daily claim v13 and activity reservation callers behind a disabled-by-default operator gate.
9. Added Testnet-only, PIN-proof and platform-wallet authorization requirements to GHC-to-Pi withdrawal requests.
10. Added focused source/runtime regression checks and synchronized package/release/migration inventory metadata.

This is a source-only verification scope: targeted regression gates ran, but the full Node 24.15.0 dependency-backed typecheck/lint/build and live Testnet acceptance are still outstanding.

## Implemented source changes

### 1. GHPV / curation
- Replaced the old per-vote `min(weight, 12% of pre-cap total)` implementation with deterministic water-filling redistribution. For panels with at least nine independent reviewers, no reviewer exceeds 12% of final normalized influence. Smaller panels use the mathematically feasible `1/N` cap.
- Duplicate reviewer identities are excluded in full rather than counted multiple times or split across choices. Invalid/non-finite/zero weights are rejected.
- Snapshot parsing now rejects malformed identities, invalid judgment modes, invalid vote choices, invalid/non-positive/out-of-range weights, and snapshots above 500 votes. It no longer silently settles a partially parsed vote set.
- Settlement binds the returned snapshot to the requested content ID and validates the server-derived UTC week epoch.
- Curator calibration reads now use the shared Supabase REST transport, an 8-second deadline and a 512 KiB response cap. Missing configuration, transport failure, invalid JSON/rows or invalid numeric state stops settlement with `CALIBRATION_STATE_UNAVAILABLE`; it cannot silently apply default calibration values over existing rows.
- Operator settlement endpoint now has a durable per-content rate limit and fails closed when the limiter is unavailable.
- Balance-funded curation redistribution now matches the deployed SQL four-decimal precision, validates voter/author/post/reference IDs, rejects self-redistribution, enforces positive amounts no greater than 1 GHC, uses an 8-second RPC deadline and validates returned amount/balance fields. The source calls an idempotency-safe `ghc_curation_redistribute_v2` wrapper, not the older v1 RPC. The wrapper proposal returns the original ledger amount on retries and detects amount mismatches. `GHC_CURATION_REDISTRIBUTE_V2_ENABLED=false` keeps this optional transfer disabled until the wrapper is reconciled and applied. This path remains a transfer of existing GHC, not issuance.

### 2. Economy / rewards / emission pipeline
- Database-backed eligible-population resolution now fails closed if the population RPC is unavailable or returns a non-database source. It no longer treats an unavailable production population as one eligible user.
- Activity emission now requires fresh database population metrics and a single SQL transaction that reserves the user day/week cap and shared global demand together. A failed global reservation rolls back the user cap update; malformed allocator responses fail closed.
- Daily claims now call `ghc_execute_daily_claim_v13`, not the legacy process-memory-demand path. The new path uses the same shared day lock and `ghc_global_emission_demand` row as activity emission, computes the safety governor in PostgreSQL, and calls the established v12 pending-entitlement/streak RPC in the same transaction. The proposal also performs an idempotent backfill of legacy daily-claim demand from ledger metadata before activation. Failed/duplicate claim attempts compensate the demand reservation inside that transaction.
- Both DB-backed daily claims and activity emission require `GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED=true`. The flag defaults to false. There is no fallback to the older process-memory governor in DB-backed deployments.
- Prepared `supabase/proposals/20261119_atomic_global_emission_allocator_v13_review.sql`. It includes an idempotent backfill of prior daily-claim demand from ledger metadata, the shared serialized allocator, daily claim v13, and an activity v2 transaction that rolls back user caps if global demand reservation fails. It is review-only, not in canonical migration inventory and not applied. It must be reconciled against the exact Testnet history, rehearsed on an isolated branch, and operator-approved before activation.
- Prepared `supabase/proposals/20261119_curation_redistribute_v2_idempotency_review.sql` to serialize by reference and return the actual original transfer amount on retries. It is also review-only and unapplied; optional curation transfers remain disabled until `GHC_CURATION_REDISTRIBUTE_V2_ENABLED=true` is explicitly approved after Testnet verification.
- Generic reward evaluation remains locked to daily-claim-only issuance. Votes, GHPV settlement and curation judgments do not mint GHC.

### 3. Withdrawals
- GHC-to-Pi withdrawals now require all required enablement conditions: `GHC_WITHDRAWALS_ENABLED=true`, `GHC_WITHDRAWALS_TESTNET_ONLY=true`, `PI_NETWORK=testnet`, `VERCEL_ENV` not equal to `production`, and an explicit valid `GHC_WITHDRAWAL_GHC_PER_PI` operator-approved rate.
- Request creation requires a request-bound withdrawal PIN proof, an existing mapped Pi identity, active payout authorization, and an exact match to a platform-API-verified Pi wallet address. Scope-only/provisional destinations are rejected for this manual GHC withdrawal lane.
- The withdrawal domain independently validates the wallet address, idempotency key, amount positivity and eight-decimal precision before calling the database.
- Withdrawal health diagnostics and the final release audit now report the full Testnet-only gate rather than only the legacy enable flag.
- `.env.example` now defaults the explicit Testnet unlock, GHC purchases, activity rewards, referral settlement, curation redistribution, tips, marketplace GHC payouts and withdrawals to disabled. Operators must opt in to individual Testnet features; no broad unlock is pre-enabled by the sample template.
- The operator settlement path remains manual: the app does not send Pi from this GHC withdrawal request endpoint. The operator must verify external settlement evidence before invoking the atomic GHC debit/completion RPC.

## Regression verification

- Consolidated network/DB-independent static verifier: **63/63 PASS**.
- Full `npm run verify:static` aggregate exceeded the available command time budget before a clean shell exit. The registered checks after the consolidated verifier were run in bounded segments; all passed. Do not treat this as a recorded `npm run verify:static` exit 0.
- Latest GitHub CI at baseline commit `58eb5a3`: static job **PASS**; typecheck job failed before invoking `tsc`, because RUN288's pretypecheck ordering assertion was stale. The RUN288 gate is now moved to the first position in `pretypecheck` and RUN376 tests are included there; a new CI run is required to certify actual typecheck/lint/build.
- Reproducible npm audit job completed in 53 seconds and failed: 22 vulnerable package entries (1 critical, 13 high, 6 moderate, 2 low). See `docs/RUN377-DEPENDENCY-AUDIT-AND-CI-REMEDIATION-2026-11-19.md` and the archived report from workflow run `44501928581`; do not use blanket `npm audit fix` because the available Zod fix is major and the Pi SDK dependency chain has no automatic fix.
- The typecheck/lint/build CI job failed before `tsc` due the RUN288 pretypecheck ordering assertion, not a compiler diagnostic. The gate was moved to the first pretypecheck command locally; a new CI run is still required.
- Dependency patching was not possible in this workspace because npm registry access returned `EAI_AGAIN` and the local npm cache is empty. The lockfile was not partially edited.
- RUN376 source contracts: **43/43 PASS**.
- RUN376 GHPV runtime tests: **5/5 PASS**.
- Changed TypeScript syntax checks: **16/16 PASS**. This is syntax/transpilation only, not a dependency-backed typecheck.
- Withdrawals health: **25/25 PASS**.
- Economy RPC deadlines: **12/12 PASS**.
- Economy DB boundaries: **10/10 PASS**.
- Reward/payment contract: **10/10 PASS**.
- Withdrawal streaming boundary: **9/9 PASS**.
- Unified earnings ledger: **20/20 PASS**.
- Achievement account isolation: **6/6 PASS**.
- Rewards/membership request guards: **10/10 PASS**.
- Pi withdrawal KYC contract: **14/14 PASS** (missing Phase 4 KYC/identity/settlement-boundary documentation added).
- Pi withdrawal boundary: **12/12 PASS**.
- Withdrawal fee contract: **8/8 PASS**.
- Pi identity/payout authorization: **10/10 PASS**.
- Cross-domain settlement: **8/8 PASS**.

The consolidated static verifier passed, and the remaining registered static checks were run in bounded segments. A full dependency-backed TypeScript typecheck, lint, Next.js production build, browser/device E2E and live database/provider acceptance are not claimed: the available workspace is Node 22.16.0, the project requires Node 24.15.0, and `node_modules` is absent. The two RUN376 SQL proposals were reviewed statically but not compiled by PostgreSQL or applied to any database.


**Remaining GHPV calibration limit:** the deployed `gh_curator_calibration` schema does not persist `day_key` or `day_delta_abs`, and the current settlement loader cannot enforce `MAX_JCS_DELTA_PER_DAY` across separate settlement transactions. The source now fails closed on unavailable/malformed calibration reads, but the daily calibration cap is not certified as durable. Keep automated GHPV settlement disabled until a per-reviewer-serialized SQL calibration/day-cap proposal is designed, rehearsed and verified. This does not mint or mutate GHC.

## Required operator gates / known limits

1. **Atomic global emission proposal is not applied.** Keep `GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED=false` until migration history and exact live SQL definitions are reconciled, the proposal is rehearsed on an isolated Testnet branch, and concurrency/idempotency/rollback tests pass. With the flag false, DB-backed daily claims and activity issuance return 503 rather than use the weaker legacy path.
2. The activity SQL wrapper performs the per-user daily/weekly cap update and shared global-demand reservation in one transaction; if the global reservation fails, the SQL exception rolls back both. The current function has no downstream issuance caller in this source tree.
3. GHC-to-Pi withdrawal remains disabled by default and requires an explicit operator-approved GHC/Pi rate. It is still a manual operator settlement product, not an automatic Pi transfer.
4. Curation redistribution v2 remains disabled by default until its separate idempotency wrapper proposal is reconciled/applied and replay/amount-mismatch tests pass.
5. Pi SDK authentication still has the external Sandbox/Portal rejection described in RUN373; this work does not repair Pi Portal registration or Pi Utilities authorization.
6. Testnet migration history remains materially drifted from the local source migration inventory. No `db push`, migration repair, replay, SQL schema mutation or live migration was performed.
7. Current workspace uses Node 22.16.0, while the project requires Node 24.15.0; `node_modules` is absent. Full typecheck/lint/Next build and browser/device tests remain required.

**Mainnet remains empty and untouched. No live Supabase mutation, migration application, ledger mutation, payout, payment, GitHub push, Vercel deployment or Mainnet action occurred. Production remains NOT APPROVED.**
