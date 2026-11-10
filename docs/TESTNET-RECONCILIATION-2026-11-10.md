# GreenHaven Testnet reconciliation and repair log — 2026-11-10

## Scope and safety

The Supabase CLI executable was unavailable in the working environment and an npx acquisition attempt did not complete. New source migrations were authored in the repository timestamp format and validated by the migration source-manifest and SQL lexical checks. A future operator must still reconcile the complete migration history before using the CLI.

- Project: `GH Connect Testnet Supabase` (`tpckwgdsjlkzscjlxiwe`, `eu-west-1`, PostgreSQL 17.11).
- Source archive: `GREENHAVEN-0.338.20-RUN249-15-SAFE-UPGRADES.zip`.
- Resulting project version/archive: `0.338.21` / `GREENHAVEN-0.338.21-RUN250-255-TESTNET-SECURITY-RECONCILIATION.zip`.
- This is a Testnet-only record. Mainnet was not accessed or changed.
- No user balances, ledger entries, payment intents, payout requests, provider payments, or stored media objects were modified by the reconciliation operations.

## Applied Testnet reconciliation migrations

The following source-equivalent additive SQL was applied through the connected Supabase migration operation and verified with read-only postflight queries:

| Generated Supabase version | Recorded name | Canonical source file represented | Verification |
|---|---|---|---|
| `20261110085225` | `phase7_durable_community_governance_reconciliation` | `20261107170001_phase7_durable_community_governance.sql` | Moderation append RPC and actor index exist; existing report queue index covers the report status query; deny-client policies exist; anon/authenticated execute denied; service_role execute allowed |
| `20261110085344` | `withdrawal_rpc_acl_and_recovery_atomicity` | `20261110100001_withdrawal_rpc_acl_and_recovery_atomicity.sql` | Recovery table and five RPCs exist; payout ownership lookup exists; client RPC execution denied; direct payout table access revoked |
| `20261110085351` | `wallet_recovery_reset_lock_race_guard` | `20261110110001_wallet_recovery_reset_lock_race_guard.sql` | Replacement reset RPC exists; row locks, recovery lock recheck and 24-hour cooldown guard are present |
| `20261110091735` | `phase1_curation_community_guard_reconciliation` | `20261106110001_phase1_curation_community_guard_reconciliation.sql` | Curation preflight and community feed RPC exist; internal GHPV write helper denied to anon/authenticated; service_role execution retained |
| `20261110092119` | `server_only_security_definer_rpc_acl_hardening` | `20261110160001_security_definer_rpc_server_only_acl_hardening.sql` | 0/290 public SECURITY DEFINER functions executable by anon/authenticated; 286 retain service_role execution; postgres default ACL hardened |
| `20261110092226` | `function_search_path_hardening` | `20261110170001_function_search_path_hardening.sql` | Both mutable search_path warnings cleared; both function configs now search_path=pg_catalog |
| `20261110092347` and `20261110092407` | `remove_verified_duplicate_indexes` | `20261110180001_remove_verified_duplicate_indexes.sql` | Two exact duplicate indexes removed; command was submitted twice idempotently, so both generated history records remain |
| `20261110093142` and `20261110093227` | `rls_policy_dedup_and_initplan_optimization` | `20261110190001_rls_policy_dedup_and_initplan_optimization.sql` | Eight redundant false/identical policies removed; all seven auth.uid() RLS initplan warnings cleared; command submitted twice idempotently |
| `20261110093228` | `supporting_foreign_key_indexes` | `20261110200001_supporting_foreign_key_indexes.sql` | All eleven missing FK-supporting indexes added; unindexed foreign-key advisor count is zero |

**Migration-history caveat:** These are generated MCP history versions and names, not the original canonical filename timestamps. The canonical files remain in `supabase/migrations`. No original history for migrations 1–189 was available despite manual SQL Editor application. Do not run `supabase db push`, `supabase migration repair`, or hand-edit migration history until every historical migration and live object has been reconciled. Do not replay migrations 1–189.

## Read-only live snapshot

- 140 public tables; RLS enabled on all 140.
- 133 public policies. Thirteen RLS-enabled tables have no policy, which currently means client access is denied by RLS; verify their service-only RPC and grants rather than adding generic policies.
- Supabase security advisor after Run #251/#252: 0/290 public SECURITY DEFINER functions are executable by anon/authenticated; 286 retain service_role execution. The postgres-owned public-schema default function ACL now excludes anon/authenticated. Both mutable search_path warnings are cleared. The supabase_admin default ACL remains unchanged because postgres is not a member of supabase_admin.
- Performance advisor after Runs #253–#255: duplicate-index, unindexed-foreign-key, auth RLS initplan and multiple-permissive-policy findings are all zero. 117 unused indexes remain (including newly added FK indexes on a low-traffic Testnet); they are not grounds for automatic deletion.
- Pi identity table: 3 rows; canonical public identity table: 3 rows; profile rows: 4; account anchors: 4. One profile/account anchor has no Pi identity, no transactions and no active session; one expired orphan session remains. It was not deleted or automatically linked.
- GreenHaven custom sessions: 213 records, 6 currently active; one expired session has no current Pi identity mapping. No active orphan session was found.
- `auth.users` and `auth.sessions` are empty because this product's current authentication path is verified Pi `/v2/me` → `gh_pi_identities` → opaque HttpOnly `gh_sessions`; do not migrate these accounts into Supabase Auth without an explicit identity migration design.
- Media: `gh-media` is private with a 50 MiB object limit; all 39 ready media asset rows map one-to-one to 39 storage objects, with no orphan assets/objects or expired open uploads.
- Marketplace: 8 listings and 0 orders. Payment intents: 15 (8 FULFILLED, 5 CANCELLED, 2 old APPROVED membership intents with no txid/completion/entitlement). GHC transactions: 59 (38 posted, 4 Daily Claim pending, 17 expired). Unified earnings ledger entries: 24. Active memberships: 3 (1 VIP, 2 VVIP). Referral attributions: 1; referral rewards: 0. Pi cashback entitlements/periods/payouts: 0. GHC transfer requests: 0. GHC withdrawal requests: 0. Bank/seller payout requests: 0. Pi earnings payout requests: 11 (10 released, 1 uncertain). Community: 1 community, 1 member. Posts: 5. Curation votes/activity: 0.

Counts are metadata-only and do not expose user IDs, financial amounts, media paths, or personal data.

## Curation reconciliation applied

The live curation path had an exposed internal SECURITY DEFINER helper: `gh_ghpv_record_curation_weight(text,text,text,numeric,text)` was executable by `anon` and `authenticated`, even though the application calls it only from the atomic server-side wrapper. That direct RPC could bypass the canonical visibility preflight, per-user daily quota serialization and mandatory activity audit.

The source-equivalent curation reconciliation was applied as migration record `phase1_curation_community_guard_reconciliation` (`20261110091735`). Postflight confirmed:

- `gh_curation_preflight` and `gh_community_post_list` exist.
- `gh_ghpv_record_curation_weight` denies anon/authenticated and remains executable by service_role.
- `gh_post_curation_set_with_reward` and `gh_community_post_list` are server-only.
- The aggregate `gh_post_curation_counts` is also server-only after Run #251; no browser code invokes Supabase RPC directly.
- No curation votes or activity rows were inserted by this migration.

**Economic boundary:** GHC curation credit remains intentionally disabled by the Daily-Claim-only issuance policy (`ghc_curation_reward_credit` returns a non-credit result). The curation vote/GHPV/audit pipeline can operate, but this does not enable GHC issuance or redistribution.

## Economy reconciliation notes

- Ten terminal Pi earnings payout requests are in `released` state with failure codes and no provider payment ID/txid/verified receipt. Their ledger has matching reserve and available-release entries of equal amounts. One additional payout request is `uncertain`, with one execution attempt, no provider ID/txid/verified receipt, no active lease, and one reserved ledger hold. Do not settle or release it without provider reconciliation.
- Two membership payment intents remain `APPROVED` and are older than 72 hours. Both have provider payment IDs but no txid, submitted/completed/fulfilled timestamps, or linked entitlement. They must be checked against the Pi provider before any fulfilment or cancellation; no automatic membership grant was made.
- Four Daily Claim V12 entries remain pending; two are older than the 48-hour lock and two are still within it. The authenticated claim/reconciliation route handles eligible user-owned holds; this audit did not claim them or change balances.
- The 10 terminal payout reservations have corresponding available-release ledger entries of equal amount. The one uncertain request remains reserved as expected.

## Marketplace migration conflict found and corrected in source

The live Testnet `gh_marketplace_order_events` table is the Phase 21 immutable journal, with columns `id`, `order_id`, `event_type`, `actor_id`, `actor_source`, `before_state`, `after_state`, and `created_at`. Its event-type constraint permits only the existing uppercase lifecycle categories.

The original Phase 9.4 migration draft attempted `CREATE TABLE IF NOT EXISTS` with a different shape (`actor_role`, `note`, `metadata`) and a lower-case event vocabulary. Because the table already existed, PostgreSQL would skip the table creation and later trigger inserts would reference missing columns and violate the existing event-type constraint. The migration also installed a second event-capture trigger.

The source migration `20261107190001_marketplace_fulfilment_tracking_timeline.sql` has now been corrected to:

- Reuse the Phase 21 journal without replacing its schema or immutable trigger.
- Extend the existing `gh_marketplace_record_order_event()` trigger function and update trigger to capture fulfilment/tracking fields in `before_state` and `after_state`.
- Preserve allowed `actor_source` and uppercase `event_type` values.
- Adapt the participant-scoped timeline RPC to the existing journal fields.
- Import legacy audit metadata into the existing append-only shape without inventing buyer/seller attribution.

Migrations 194 and 195 remain unapplied. Migration 194 now has an idempotent conditional rename for the legacy reservation RPC, but still requires disposable PostgreSQL validation of SKU inventory reservation/release/commit and oversell concurrency. Migration 195 requires validation against the actual Phase 21 journal schema and must follow 194. Testnet currently has 8 listings and no orders, so no marketplace records were changed during this review.

## Run #250 application identity fix

The original `lib/server/identity/pi-identity-store.ts` treated PostgREST lookup failures as “identity not found” and used `resolution=merge-duplicates`, which could overwrite the stable `gh_user_id` when a Pi identity already existed. The source has now been changed to:

1. Throw on database lookup failure rather than treating it as an absent identity.
2. Update only mutable username and timestamp fields through a PATCH scoped by `pi_app_uid`.
3. Insert new mappings with `resolution=ignore-duplicates`; a concurrent winner is re-read and retained.
4. Fail closed in production instead of accepting stale in-memory identity data after an authoritative database failure.
5. Preserve the existing database uniqueness index `uq_gh_pi_identities_gh_user_id`.

Static contract check: `scripts/check-run250-identity-mapping-integrity.mjs` — 10/10 passed. Security ACL check: `scripts/check-run251-security-definer-rpc-acl.mjs` — 8/8 passed. Search-path check: `scripts/check-run252-function-search-path.mjs` — 5/5 passed. Duplicate-index check: `scripts/check-run253-duplicate-index-repair.mjs` — 5/5 passed. Curation and marketplace source checks pass; these are static checks, not provider or two-account E2E tests. No live sign-in, payment-provider or concurrency test was performed.

## Outstanding blockers before production readiness

1. Review the four SECURITY DEFINER helpers that intentionally remain non-service_role-executable (legacy story-view, treasury internal helper, membership trigger function, disabled generic reward staging) and confirm no direct app callers; all 290 public SECURITY DEFINER functions are now denied to anon/authenticated.
2. Inspect all 13 no-policy tables and confirm each has the intended service-role-only access path.
3. Reconcile and test the historical manual migration state. Supabase reports eleven generated history rows representing nine distinct reconciliation operations; this is not a complete history for the original 1–201 source migrations.
4. Review authentication/session revocation and identity deletion lifecycle, including active-session invalidation and Pi permission revocation behavior.
5. Verify media signed upload, finalize, private delivery, content-type/size limits and orphan cleanup with two test accounts.
6. Exercise GHC/Pi marketplace payment, inventory reservation, refund/adjustment and seller payout lifecycles with synthetic Testnet users and provider receipts.
7. Exercise GHC rewards, curation settlement, referral, membership and earnings/payout concurrency/idempotency on disposable PostgreSQL before enabling issuance or payouts.
8. Review the remaining 117 unused-index advisor findings after Testnet traffic develops; the eleven FK indexes were just added and should not be dropped without workload evidence.
9. Install/use Node `24.15.0` (project engine `^24.15.0`) and install the lockfile dependencies before running dependency-backed typecheck, lint, build and E2E tests. The current environment is Node `22.16.0` and the project has no installed `node_modules`.
10. Obtain explicit approval and a separately verified backup/rollback plan before any Mainnet operation.

## Operator rule

No bulk migration deployment. No automatic balance correction, payout, refund, payment capture, provider transfer, or Mainnet change. Apply only reviewed additive changes, one at a time, with read-only postflight verification and feature-specific tests.


## Pi earnings withdrawal follow-up — Run #256

The wallet screenshot and read-only Testnet query identify request `534bb470-5702-49da-a5e2-47bfce7aac13` as `uncertain`, one execution attempt, no provider payment ID, no txid, no verified receipt and no active lease. The A2U executor checks Pi's single incomplete server-payment lane before creating a new A2U. Before Run #256, an unrelated incomplete payment blocked the earnings worker but was not recorded in the shared operator review queue. Source release 0.338.22 now records that blocker (including provider ID/txid and bounded metadata), adds a read-only Testnet provider-incomplete inspection to the operator treasury summary, persists sanitized diagnostic codes, and explains the block in the wallet. The source checks pass 12/12. No Pi provider mutation or reservation release/settlement was performed. Actual provider lookup and recovery remain pending until Vercel environment/log access is available.


## Run #257 — Economy and Marketplace reconciliation (2026-11-10)

- Membership: two APPROVED Pi membership intents are older than the normal operational window and each has a provider payment ID but no txid, completion timestamp or linked entitlement. Opened Treasury case `membership-approved-unfulfilled-2026-11-10` (critical). No membership was activated or payment cancelled. Provider receipts must be verified first.
- Daily Claim: four V12 claims are pending; two are older than 48 hours. Opened Treasury case `daily-claim-pending-over-48h-2026-11-10` (high). No pending GHC credit was force-posted or released.
- Referral/cashback: the one referral attribution is associated with a Pi-funded active VVIP entitlement. The current referral rule queues 5% only from a qualifying VIP GHC charge; no eligible GHC membership intent exists. The company-revenue journal contains zero events, so zero cashback periods/entitlements is consistent with current recorded revenue.
- Marketplace: eight listings (one active, three paused, four removed; four GHC and four PI; no zero/negative availability), zero orders, zero seller payouts. The one fulfilled Marketplace Pi intent is a `listing_fee` and both metadata listing references match an existing listing; it is not an orphan order.
- Marketplace schema preflight: variant table and order variant columns are absent. Base listing upsert, order snapshot, legacy order reservation and expired-reservation RPCs exist; the stock-transition trigger exists; the Phase 21 event journal and event-type constraints match the reconciled 195 source. There are no orders, so no real payment/fulfilment path can be end-to-end verified. Migrations 194–195 remain REVIEW_REQUIRED and unapplied pending disposable PostgreSQL and Testnet transactional concurrency tests.
- Run #256 added one open A2U review-queue record for the uncertain Pi earnings payout with no provider ID/txid. The two Treasury cases above are also open. No wallet balance, ledger entry, payout reservation, membership entitlement or provider payment was changed.
- Run #257 source contract: 15/15. Run #256 withdrawal review contract: 13/13. Full `npm run verify:static` passed after Run #257 (exit 0; 287 prebuild checks retained). Node 24.15.0 dependency-backed typecheck/lint/build remains unavailable in this Node 22.16.0 dependency-free environment.


## Run #258 — Live Marketplace RPC defect and withdrawal RPC postflight

- Marketplace order-list RPC defect reproduced directly: SQLSTATE `42703` because `x.created_at` was referenced outside a projection that named it `"createdAt"`.
- Applied `20261110110002_marketplace_orders_list_rpc_alias_fix.sql` to Testnet only; generated migration history version `20261110102610`. Synthetic non-user function probe returned `[]`. ACL check: SECURITY DEFINER, `search_path=pg_catalog, public`, anon/authenticated denied, service_role allowed. PostgREST schema cache reload confirmed at 10:26 UTC.
- PIN recovery and payout ownership RPCs now exist and pass synthetic non-user SQL probes; both are service-role-only. The earlier PIN recovery PGRST202 predates the migration and later schema-cache reload. Authenticated Vercel tests are still required.
- A synthetic curation intelligence refresh completed successfully inside a rolled-back subtransaction; no snapshot/history rows were retained. The prior SQLSTATE 42703 curation errors are historical and the current DB function passes this synthetic probe.
- The current Vercel `testnet` deployment is source version 0.338.25, READY on commit `237070b2817680933b82994ca72737bd1e90d505`. Its live withdrawal process invocation returned 503 `PI_PROVIDER_OUTCOME_UNCERTAIN`; the previous worker did not log the failing provider stage. Run #260 source 0.338.26 is not yet deployed. Historical withdrawal HTTP 403 still requires authenticated route verification.
- No orders, inventory, balances, payments, payouts or user recovery rows were mutated. Mainnet untouched. Migrations 194–195 remain held for disposable PostgreSQL and concurrency validation.


## Run #260 — Live withdrawal and wallet-address findings

- Connected Vercel confirms Preview deployment `dpl_HMcWzp1ma76wqdJMdGrgNpq5JcWs` is READY (Node 24.x runtime) on `testnet` commit `237070b2817680933b82994ca72737bd1e90d505`, package version 0.338.25. The exact request `8b4d2-1794314546230-14f9648ea998` returned 503 at `/api/economy/earnings/withdrawals/process`; logs show only `PI_PROVIDER_OUTCOME_UNCERTAIN`, not the failing provider stage.
- Read-only Testnet inspection of the three request IDs shown in the user's screenshots confirms each is 1.00 π gross, 0.03 π fee, 0.97 π net, status `uncertain`, and has no persisted provider payment ID, txid or verified receipt. Total reserved amount is 3.00 π. Do not force-release, mark paid, or create another payout.
- The linked `gh_pi_identities` row and active `gh_pi_wallet_authorizations` row match on the same app-specific Pi UID. The authorization was explicitly consented and recently re-verified. However, the current authorization table has no wallet-address column; the UI's “linked at sign-in” label was only an identity label, not proof that a blockchain wallet address had been retrieved or displayed.
- Current A2U uses Pi's app-specific UID as the recipient. It does not accept a user-provided Stellar public address. Run #260 requests Pi's `wallet_address` scope during explicit consent, verifies the address through the server-verified Pi `/v2/me` token response, and stores the address alongside the same UID.
- Run #260 adds a direct, read-only `GET /v2/payments/incomplete_server_payments` adapter because the pinned `pi-backend` SDK converts lookup failures into `unknown_error`; the new health probe reports only whether the global lane is clear or blocked and a safe error code. It also records execution stage and provider HTTP/error code, and prevents multiple active withdrawal reservations for one user.
- Migration `20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics.sql` is REVIEW_REQUIRED and unapplied. Do not apply it until the 0.338.26 source is deployed and the full target migration history is reconciled; it intentionally makes old UID-only wallet authorizations insufficient for new payouts.
- No existing user request, ledger entry, balance, reservation, Pi provider payment, Mainnet data or Marketplace data was changed during this inspection.
