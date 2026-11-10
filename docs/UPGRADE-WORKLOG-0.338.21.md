# GreenHaven upgrade worklog 0.338.21 — Runs #250–255

Date: 2026-11-10  
Input baseline: `GREENHAVEN-0.338.20-RUN249-15-SAFE-UPGRADES.zip`  
Target: GH Connect Testnet Supabase (`tpckwgdsjlkzscjlxiwe`) only. Mainnet was not accessed or modified.

## Source changes

- Hardened Pi identity resolution: verified Pi UID remains the immutable canonical key; first-time mapping uses insert-only conflict handling and re-reads the winner under concurrent sign-in; production does not silently create a replacement mapping when the database is unavailable or ambiguous.
- Hardened Pi-username lookup to fail closed in production rather than using stale process-memory identity data for referral attribution or recipient resolution.
- Updated identity comments and regression contracts to require verified account recovery before any mapping is recreated.
- Reconciled curation/community migration source with canonical visibility, self-curation denial, serialized daily limits, mandatory activity audit, and server-only GHPV writer access.
- Corrected marketplace fulfilment migration 195 to reuse the already-existing Phase 21 immutable order-event journal. It no longer assumes a conflicting `actor_role`/`note`/`metadata` table schema, adds duplicate event triggers, or uses event types rejected by the existing constraint.
- Added source migrations for server-only SECURITY DEFINER ACL hardening, function search-path pinning, duplicate-index cleanup, RLS policy deduplication/initplan optimization, and missing FK-supporting indexes.
- Registered Run #250–255 checks in prebuild and `verify:static`; updated migration inventory, reconciliation report, project truth, release metadata and this worklog.

## Live Testnet operations

Nine distinct additive/reconciliation operations were applied and postflight-verified. Supabase has eleven generated migration-history rows because the duplicate-index cleanup and RLS policy cleanup were each submitted twice; both operations are idempotent and both history rows are retained.

1. Community governance append RPC and missing moderation-actor index; reused the existing report queue index.
2. Withdrawal recovery table and service-role-only recovery/payout lookup RPCs.
3. Recovery PIN reset lock-race guard and 24-hour cooldown enforcement.
4. Curation/community guard reconciliation; the internal GHPV writer is server-only.
5. Revoked anon/authenticated EXECUTE from all 290 public SECURITY DEFINER functions while preserving existing service_role ACLs; changed postgres-owned public-schema default function privileges for future functions.
6. Pinned `ghc_available_balance` and `gh_reputation_level_from_points` search paths to `pg_catalog`.
7. Removed two exact duplicate indexes while retaining the canonical unique-earned and community-report queue indexes.
8. Removed eight redundant false/identical RLS policies and optimized seven `auth.uid()` policy expressions; RLS remains enabled and no client write policy was added.
9. Added eleven advisor-confirmed FK-supporting indexes.

## Postflight results

- 0/290 public SECURITY DEFINER functions executable by anon/authenticated; 286 retain service_role execution. Four internal/legacy/disabled functions retain their prior non-service-role state, including intentionally disabled `ghc_stage_pending`.
- Postgres-owned public function default ACL excludes anon/authenticated and retains service_role. The separate `supabase_admin` default ACL was not changed because the migration role is not a member of that role.
- Security advisor: no SECURITY DEFINER client-execution warnings and no mutable search-path warnings. Thirteen RLS-enabled/no-policy tables remain an intentional deny-client pattern; no generic policies were added.
- Performance advisor: zero duplicate-index, unindexed-FK, auth RLS initplan and multiple-permissive-policy findings. 117 unused-index findings remain on low-traffic Testnet; no unused indexes were dropped.
- Identity snapshot: 3 Pi identities, 3 public IDs, 4 profiles, 4 account anchors, 213 custom sessions and 6 active sessions. One incomplete profile/account has no Pi identity, no transactions and no active session; one expired orphan session remains. No identity was deleted or auto-linked.
- Media snapshot: 39 ready assets map one-to-one to 39 private `gh-media` objects; no orphan assets/objects or expired open upload sessions.
- Economy snapshot: 59 GHC transactions (38 posted, 4 Daily Claim pending, 17 expired); 24 earnings-ledger entries; 3 active memberships; 1 referral attribution but 0 referral rewards; 0 Pi cashback entitlements/periods/payouts; 0 GHC transfer requests; 0 GHC withdrawal requests; 0 bank/seller payout requests.
- Two old APPROVED membership payment intents have provider IDs but no txid, completion, fulfilment or entitlement. They require authoritative Pi provider reconciliation; no membership was auto-granted.
- Pi earnings payouts: ten released requests have no provider receipt and matching reserve/release ledger entries; one uncertain request has one attempt, no provider ID/txid/verified receipt, no active lease and one still-reserved ledger hold. It was not released or settled.
- Four Daily Claim V12 entries remain pending; two are older than the 48-hour lock and two are within it. No claim was executed during the audit.
- Marketplace has eight listings and zero orders. Curation has zero votes/activity; GHC curation credits remain intentionally disabled by the Daily-Claim-only issuance policy. Community has one community, one member and five posts.

## Marketplace migration safety

Migrations 194–195 remain unapplied. Migration 194 now uses an idempotent conditional rename for its legacy reservation RPC. Migration 195 was corrected in source after discovering that its original event-table shape conflicted with the live Phase 21 journal. Migration 194's SKU inventory reservation/release/commit path and corrected migration 195 still require disposable PostgreSQL rehearsal before Testnet application. There are no live marketplace orders to use for an end-to-end validation.

## Migration history warning

The live migration-history endpoint does not contain the user's manually applied original migrations 1–189. The eleven generated history rows are not the canonical filenames' original version numbers. The Supabase CLI was unavailable in this environment; source migration files were added in the repository's timestamp naming format and validated by source-manifest and SQL lexical checks. **Do not run `supabase db push`, `supabase migration repair`, or replay migrations 1–189 until the complete live schema and original migration history have been reconciled.**

## Validation and limitations

This worklog records source-only verification and live Testnet catalog/permission checks; it does not claim full application or provider acceptance.

- `npm run verify:static`: PASS, exit 0.
- Run #250 identity mapping contract: 10/10.
- Run #251 SECURITY DEFINER ACL contract: 8/8.
- Run #252 function search-path contract: 5/5.
- Run #253 duplicate-index contract: 5/5.
- Run #254 RLS policy cleanup contract: 5/5.
- Run #255 FK index contract: 4/4.
- Curation, Phase 7 governance and Phase 9.4 marketplace source contracts pass.
- `typecheck`, `lint` and `build` are blocked by the available Node.js 22.16.0 runtime; the project requires Node.js 24.15.0 and `node_modules` is absent. No dependency-backed TypeScript/lint/Next.js build pass is claimed.
- No live Pi provider reconciliation, payment settlement, payout execution, user-balance mutation, GHC issuance, Mainnet operation, browser/device E2E or two-account sign-in test was performed.

**Release status: NOT APPROVED for production.** Testnet security and source integrity are materially improved, but provider reconciliation, marketplace rehearsal, complete migration-history reconciliation and supported-runtime build/device acceptance remain operator gates.
