# GreenHaven Rewards audit — 0.338.53

**Audit date:** 2026-11-11  
**Source baseline:** `GREENHAVEN-0.338.53-RUN291-RELEASE-REGISTER-VERSION-REPAIR.zip`  
**Scope:** Rewards UI, daily claims/streaks, pending/matured claims, ledger/history, missions/achievements, reward adapters, operator funding/settlement boundaries, Supabase Testnet schema/RLS/RPCs, and current Vercel deployment gate.

## Result

The Rewards source contracts are in good shape. The focused audit executed **25 reward/economy/integration regression scripts successfully**. The 24 assertion-reporting scripts represented 379 passing assertions; the additional dependency-lock consistency check also passed.

Two maintenance defects were corrected surgically. No production claim, issuance, settlement, migration, database, or payment behavior was changed.

## Surgical source changes

1. `scripts/check-privileged-reward-body-bounds.mjs`
   - Replaced an obsolete assertion that looked for `request.text()` with an assertion matching the current implementation: authentication occurs before the bounded streaming reader is invoked.
   - The route itself was already correctly authenticating first and using `readBoundedText` with a 4 KiB ceiling. No route logic was changed.

2. `.env.example`
   - Documented `GHC_CREATOR_REWARD_OPERATOR_KEY` as a server-only secret.
   - Documented the minimum 32-byte requirement and that leaving it empty keeps creator reward funding/settlement disabled.
   - No secret value was added.

3. `package.json`
   - Registered `check-phase2-reward-operator-hardening.mjs` and `check-privileged-reward-body-bounds.mjs` exactly once in both `prebuild:checks` and `verify:static`.
   - This makes the operator-secret and bounded-claim-body safeguards part of routine gates instead of relying only on manual invocation.

## Verified Rewards controls

- Daily claim identity comes from server authentication; client-supplied user/amount values are ignored.
- Daily claim rate limiting is durable and fails closed when the protection service is unavailable.
- Daily claims are atomic/idempotent and create pending entitlements; the 48-hour hold is not presented as spendable balance.
- Matured daily holds are reconciled by the Wallet refresh path before the authoritative wallet snapshot. Reconciliation is authenticated, durable-database-only, bounded, and idempotent.
- Pending reward redemption derives user and amount from the server-owned hold and canonical RPC.
- Generic activity issuance remains policy-locked; verified mission achievements are non-financial under current policy.
- Mission verifier accepts only seven allow-listed codes, validates durable server-side activity, and fails closed if verification is unavailable.
- Rewards history uses the authenticated same-user wallet endpoint, bounded keyset pagination, account-bound cursors, and does not calculate wallet balance from a page of history.
- GHC and Pi cashback are separate journeys. Pi cashback payout remains explicitly Testnet-only and requires payout-wallet authorization.
- Client UI contains no ledger mint/credit/settlement authority.
- Creator reward fund/settle routes use bounded request bodies, timing-safe comparison, 32-byte minimum server secret, and finite upstream timeouts.

## Supabase Testnet read-only inspection

**Project:** GH Connect Testnet Supabase (`tpckwgdsjlkzscjlxiwe`)  
**Observed status:** `ACTIVE_HEALTHY`, PostgreSQL 17.11.  
**Mainnet project:** separately listed as `INACTIVE`; no Mainnet changes were attempted.

Verified live state:

- `ghc_transactions`, `ghc_claim_streak_state`, `gh_user_achievements`, `gh_earnings_reward_attempts`, `gh_content_rewards`, and `gh_creator_reward_events` exist with RLS enabled.
- `ghc_transactions` has owner-only SELECT and explicit client-deny INSERT/UPDATE/DELETE policies.
- Claim streak, mission achievement, reward-attempt, content-reward, and creator-reward tables have explicit client-deny policies.
- The sensitive RPCs inspected (`gh_rewards_mission_complete`, `ghc_execute_daily_claim_v12`, `ghc_claim_pending`, `gh_creator_reward_pool_fund`, `gh_creator_reward_settle_funded`) are executable by `service_role`, not `anon` or `authenticated`.
- The live streak table had 3 rows; all 3 had valid cycle-day bounds and claim dates.
- Daily-claim ledger aggregates at audit time: 17 posted, 17 expired, and 4 pending; 3 pending holds were older than 48 hours and none of the pending holds were marked for review. The Wallet refresh flow is designed to reconcile matured holds before refreshing the authoritative balance. This is an aggregate check only; no account identifiers were read into the report.
- No Supabase DDL, data mutation, migration application, or function deployment was performed.

### Database migration-history follow-up (not changed)

The live Testnet migration ledger currently contains 39 entries spanning only `20261110085225` through `20261111114429`. The source archive contains 221 migration files beginning `20261022010001`; several Rewards source migrations (including the Phase 8 mission verifier migration) are not represented in the live migration ledger, even though the expected tables/RPCs and RLS policies are present.

This is a **migration provenance/history reconciliation item**, not proof that the Rewards schema is missing. Do not run a blanket `supabase db push` or replay the historical Rewards migrations until the team establishes whether the earlier schema was intentionally baselined, manually applied, or had its migration history reset. Reconcile the migration ledger against live schema/function definitions first.

## Vercel / deployment status

The latest observed `testnet` deployment (`b9aafcb3746c113e38f2ac6f23b8c35c271e2791`) is **ERROR** at the prebuild gate. Its log shows `Phase 1–10 upgrade pack: 19/20`; the only failure is P1-A, the package/app-release/consolidated-register version agreement. This is the known release-register metadata mismatch, not a Rewards regression. The build stopped before Next.js production build or runtime acceptance, so this audit does **not** claim that the updated Rewards source has been deployed or passed live Vercel acceptance.

## Verification limits

- The working environment has Node `22.16.0`; this project requires Node `24.15.0`.
- `node_modules` is not present in the audit workspace.
- Consequently, a full Next.js production build, TypeScript typecheck, ESLint run, browser E2E, and authenticated two-account Rewards acceptance test were **not** run here.
- All focused source regression scripts listed above were run directly and passed. The dependency lock integrity check also passed.
- Vercel and Supabase inspection was read-only. No remote GitHub write, Vercel deployment, or database migration was performed.

## Release posture

Keep production financial features gated. Do not enable Pi-funded GHC acquisition, paid business checkout, cashback payout, or other financially sensitive capabilities as a side effect of this Rewards audit. Rewards daily claims remain server/database authoritative; missions remain non-financial; Pi cashback remains separately gated to Testnet.
