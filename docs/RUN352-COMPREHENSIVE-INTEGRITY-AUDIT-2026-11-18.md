# RUN352 — Comprehensive financial and migration integrity audit

**Date:** 2026-11-18  
**Working source:** `GREENHAVEN-0_338_99-RUN344-PI-AUTH-DIAGNOSTICS-FIX.zip` merged with `GREENHAVEN-0_338_99-RUN351-AUDIT-FIXES.zip`  
**Package version retained:** `0.338.99`  
**Disposition:** Source-only remediation candidate. **NOT production approved.**

## Safety and scope

- All connected Supabase inspection in this run was read-only: project inventory, migration history, table/function catalog, RLS policies, grants, advisors and aggregate financial reconciliation queries.
- No Mainnet database changes, financial operations, migrations, account mutations, payout attempts, deployments or credential changes were performed.
- No Testnet database changes or migrations were performed either.
- Mainnet must remain untouched. The Mainnet project currently returns zero public base tables and zero migration-history rows; this is a critical environment/readiness discrepancy, not permission to initialize it.

## Executive findings

1. **The source migration inventory is larger than the applied Testnet history.** There are 230 canonical migration files and 230 manifest rows. Testnet has 46 migration-history entries: 15 exact source matches, 11 same-slug/different-version candidates whose content equivalence is unverified, and 20 applied history entries with no matching source file. The other 206 source files are not recorded by exact version in the current Testnet history; nine source files are same-slug candidates that map to eleven history rows because two source files each have two corresponding history entries. Do not `db push`, replay or infer equivalence until every gap is reconciled.
2. **Mainnet is not schema-ready in the connected project.** The Mainnet project currently has 0 public base tables and 0 migration-history rows. It has one public `rls_auto_enable()` function attached to the `ensure_rls` DDL event trigger; this is an event-trigger function, not an ordinary application RPC. No schema was initialized.
3. **Testnet payout ledger reconciliation currently balances.** All 18 payout requests match their ledger lifecycle: five paid requests each have one reserve and one settle; thirteen released requests each have one reserve and one release. There are zero request-level ledger-pattern mismatches. The aggregate live balance function reports 130,000,000 PI atomic available, zero reserved and 50,000,000 atomic paid across six users.
4. **GHC balance snapshot is non-negative.** Six users have total available/spendable GHC 19.1680, with no negative balance and no spendable amount above available. All 87 current GHC transaction rows are earned credits (56 posted, 6 pending, 25 expired); there are no recorded spend/transfer/purchase rows in this Testnet sample, so those rails cannot be proven end-to-end from live records.
5. **Membership is active but historical payment linkage needs evidence review.** Three entitlements are active (one VIP, two VVIP), with nine audit JSON entries. Six membership intents are fulfilled: three link directly to current entitlement rows; the other three belong to users who still have current entitlements. This is not evidence of missing current access, but the single entitlement-event row is insufficient to independently reconstruct every historical transition. No automatic entitlement repair was made.
6. **One marketplace fee record needs historical review.** There is one fulfilled marketplace listing-fee intent with listing metadata, but its referenced listing ID does not match a current listing. It may have been deleted after payment; the current database cannot prove the original effect. There are eight listings but zero marketplace orders, proceeds snapshots, adjustments or refunds, so order settlement cannot be validated against live order data.
7. **Pi wallet authorization state is consistent in current Testnet records.** Five active authorizations have `user_explicit` consent, verified `wallet_address` scope and verified wallet address. One older authorization is superseded. Live Pi Browser authentication/device acceptance was not performed.
8. **Security posture is strong in several key areas, with a hardening opportunity.** Testnet has 340 public functions; zero SECURITY DEFINER functions are executable by anon/authenticated and zero SECURITY DEFINER functions lack a fixed search path. Six server-only financial tables still retain client SELECT grants despite deny-all RLS policies; a review-only proposal was added to revoke those redundant grants. Sixteen other RLS-enabled/no-policy tables have no client table grants, so the advisor findings are informational/server-only, not confirmed exposure.

## Migration inventory and effects

### Manifest and SQL inventory

- 230 canonical SQL migrations; 230 matching manifest rows.
- Manifest classifications: 121 `REQUIRED`, 106 `REVIEW_REQUIRED`, 2 `PROPOSAL`, 1 `REQUIRES_APPROVAL`.
- 28 additional SQL files exist outside the canonical migration directory; they must not be swept into the migration sequence.
- Static structural inventory across the 230 migrations: 179 `CREATE TABLE` occurrences; 251 `ALTER TABLE`; 483 `CREATE FUNCTION`/`CREATE OR REPLACE FUNCTION` statements; 293 index-create statements; 25 trigger-create statements; 159 policy-create statements; 165 RLS-enable statements; 588 `GRANT` and 593 `REVOKE` occurrences; 79 `DO` blocks; 259 `IF EXISTS` and 662 `IF NOT EXISTS` guards; 351 catalog/metadata guard occurrences; 43 `DELETE`, 273 `UPDATE` and 293 `INSERT` statement occurrences. These are source-token counts, not proof of execution or affected-row counts.
- Four column-type conversions were identified, all for `user_id` on `gh_withdrawal_pins` and `gh_withdrawal_pin_recovery` (one is a dynamic guarded conversion). Testnet currently reports both columns as `text`, `NOT NULL`, and zero remaining FKs to `auth.users`. This proves the current shape, not which historical migration produced it.
- The canonical migration gate reports no duplicate migration version prefixes, 230 source files synchronized with the manifest, and 461 SECURITY DEFINER definitions checked for fixed `search_path`. SQL lexical integrity passes across 239 migration/proposal files after adding the new review-only proposal.
- The source contains repeated function revisions across historical migrations. A scan found 92 repeated function signatures and 22 exact same-body clusters across migration files. These are predominantly `CREATE OR REPLACE`, bootstrap/ensure, repair or compatibility revisions. They are not proof of duplicate live routines and must not be deleted without history reconciliation.

### Testnet history reconciliation

The current 46-row history map is preserved at `docs/RUN333-MIGRATION-HISTORY-RECONCILIATION.csv`. RUN352 adds:

- `docs/RUN352-MIGRATION-STATUS-2026-11-18.csv` — all 230 source files classified against the current Testnet history.
- `docs/RUN352-TESTNET-HISTORY-UNMATCHED-2026-11-18.csv` — the 20 applied history rows without a matching source filename.
- `docs/RUN352-MIGRATION-IMPACT-INVENTORY-2026-11-18.csv` — per-migration structural/DML/conditional-guard counts.

The eleven same-slug/different-version candidates remain unverified; filename similarity is not semantic equivalence. The twenty history rows without source remain unreconstructable from this archive. The 106 review-required files, two proposals and one approval-required file remain held. The review order is not permission to apply. No migration was generated from inferred history and none was applied.

## Live Testnet financial integrity

### PI earnings and payout ledger

- 43 PI earnings ledger entries: 7 credits, 18 reserves, 13 release-reserve entries and 5 settles.
- 18 payout requests: 5 `paid` and 13 `released`.
- Each paid request has provider payment ID, provider txid and provider verification timestamp; each has exactly one reserve and one settle ledger entry.
- Each released request has no provider payment ID, txid or provider verification timestamp; each has exactly one reserve and one release-reserve entry.
- No payout-level ledger-pattern mismatch; no duplicate payout idempotency key, provider payment ID or earnings-ledger `unique_ref`.
- The read-only `gh_earnings_balances` function reports six users, total available 130,000,000 atomic, reserved 0, paid 50,000,000 atomic, and zero balance errors.

### GHC

- 87 `ghc_transactions`: 56 posted earned (19.1680), 6 pending earned (2.4320), 25 expired earned (14.8480).
- Twenty-five user/reference pairs have one expired and one posted earned row of the same amount; there are zero pairs with more than one posted row. This is consistent with expired-attempt/retry history, not duplicate posted credit.
- Six users have total available and spendable balance 19.1680 GHC; no negative balance or spendable-over-available result.
- There are no live GHC spend, transfer or purchase transaction rows in this Testnet sample, so those paths remain source-gated rather than live-data-verified.

### Membership

- Three current active entitlements: one VIP and two VVIP; none expired. Their audit JSON arrays contain nine entries in total.
- Six fulfilled membership intents: three directly link to current entitlement rows; three do not directly link but their users still have current entitlement rows. No completed membership intent belongs to a user with no current entitlement.
- The membership exception detail reports ten non-directly-linked rows because it also includes five cancelled and two approved intents; those are not completed-payment entitlement defects.
- Only one row exists in `ghc_membership_entitlement_events`. Provider settlement evidence and full historical transition ordering still need independent evidence review. Do not auto-grant, revoke or rewrite entitlements from this report.

### Marketplace

- Eight listings; zero orders; zero proceeds snapshots; zero adjustments; zero refund operations.
- One fulfilled marketplace listing-fee intent includes a listing ID in metadata, but that ID matches neither a current listing nor an order. Historical deletion vs missing side effect cannot be distinguished from current records alone.
- Current source contracts for server-side fee calculation, GHC settlement, Pi intent verification, order atomicity, seller-net payout allocation, fulfilment and refund idempotency pass their registered checks. Live order settlement remains unproven because there are no order rows.

## Pi authentication and wallet authorization

- Testnet has six Pi identity rows and sixteen active GreenHaven sessions. `onboarding_completed` is false on all six identity rows; this field was not treated as proof of authentication failure without the onboarding contract and user journey evidence.
- Five wallet authorization rows are active, all with `consent_source=user_explicit`, verified wallet-address scope and verified wallet address. One row is superseded and has no current verification timestamps.
- Source gates verify Pi Platform `/v2/me` identity proof, explicit wallet consent, verified scope/address binding, token-free diagnostics, finite auth timeout, no local identity fallback and service-role-only grant RPCs.
- No live Pi Browser/device handshake, provider payment, or A2U payout was executed during this audit.

## Security, grants, duplicate routines and dead-code candidates

- Testnet catalog: 340 public functions; zero client-executable SECURITY DEFINER functions; zero SECURITY DEFINER functions missing a fixed search path.
- Sixteen RLS-enabled tables without policies have no anon/authenticated/PUBLIC table grants.
- Six server-only financial tables (`gh_marketplace_orders`, `gh_marketplace_order_proceeds`, `gh_marketplace_order_adjustments`, `ghc_membership_entitlements`, `ghc_payment_intents`, `ghc_withdrawal_requests`) retain anon/authenticated SELECT grants, but each has an explicit deny-all RLS policy. Source review found no direct browser/client table reads; server routes use privileged server-side access. A non-canonical review proposal was added at `supabase/proposals/20261118_revoke_client_select_financial_tables_review.sql`. It changes no database until separately reviewed and applied.
- Three live overload groups exist: `gh_company_revenue_event_append_attributed`, `gh_pi_wallet_authorization_adopt_provider_address`, and `gh_pi_wallet_authorization_grant`. They are version/compatibility signatures, not accidental duplicate function identities.
- The legacy three-argument `gh_pi_wallet_authorization_grant` and `ghc_stage_pending` are present but have no EXECUTE for anon, authenticated or service_role and no application-source caller was found. They are cleanup candidates, not deleted. `gh_marketplace_order_create_reserved_pre_variant` is not dead: the current marketplace order wrapper calls it internally. Trigger functions are also not classified as dead code.
- Testnet performance advisor reports 116 unused indexes. These are informational only; do not drop without query-workload observation and an index-usage/constraint review.

## Code fixes and verification

RUN352 made the following source changes:

1. Added the missing `normalizeListingSearch` export to `lib/active-upgrades/marketplace.ts`, using Unicode NFKC normalization, control-character replacement, whitespace collapse, trim and a 100-character bound. The marketplace screen already imported this helper, and the existing source gate failed because the export was absent.
2. Added `scripts/test-marketplace-search-normalization.mjs` (8 runtime assertions) and registered it in both `verify:static` and `prebuild:checks`.
3. Updated the stale RUN283 runtime test to test the current active-module APIs rather than removed historical helper names; 59/59 assertions now pass across 11 modules.
4. Updated the Phase 28 wallet shortcut source check to expect the current dependency list (`walletOpen`, `marketplaceOpen`, `ecosystemOpen`) so the check protects the real overlay behavior instead of failing on a stale assertion.
5. Removed exact duplicate command invocations from package scripts: one repeated RUN261 check in `verify:static`, and repeated project-truth/settings-performance checks in `prebuild:checks`.

Verification results:

- The 366-command `verify:static` chain completed successfully when split into bounded chunks; no script failures remained.
- 44 focused wallet, PI payout, GHC, membership, marketplace, RPC ACL, search-path, duplicate-index, RLS cleanup, migration-integrity and SQL-lexical gates passed.
- Marketplace search source contract: 6/6; new search runtime test: 8/8.
- RUN283 active-module runtime suite: 59/59.
- Phase 28 wallet consent flow: 46/46.
- RUN350 and RUN351 regression suites: 14/14 and 25/25.
- Dependency manifest/lockfile consistency check: 12/12; dependency security policy: 11/11.
- The monolithic static command exceeded the execution time limit, so the exact command chain was run in chunks. This is not a failing assertion.

## Build and release blockers

- This runtime has Node `22.16.0`; the project pins Node `24.15.0` in `.nvmrc` and the dependency security workflow. Attempting to install `24.15.0` in this environment returned “Version not found”.
- `node_modules` is absent. The prebuild chain stops at `check-jsx-duplicate-props.mjs` because it cannot resolve the local `typescript` package. Global `tsc --noEmit` is not a valid project typecheck here and reports 21,551 missing-module/JSX errors beginning with missing `react` declarations.
- Therefore dependency-backed TypeScript typecheck, ESLint, Next production build and browser/device end-to-end acceptance remain unverified. The package manifest and lockfile dependency roots match; this is an uninstalled environment, not proof that a package declaration is missing.
- Historical GitHub audit evidence in the source docs records 29 dependency vulnerabilities (2 critical, 21 high, 5 moderate, 1 low). No current registry audit was run because npm registry access is unavailable in this runtime. Do not invent lockfile hashes or force unsafe Pi SDK overrides.

## Required next steps before production

1. Recover the twenty source-less Testnet migration SQL files from the exact historical release/branch or obtain a trusted provider-side export; do not reconstruct from filenames.
2. Prove semantic equivalence for all eleven same-slug/different-version migration candidates.
3. Compare all 230 source migration effects with the Testnet catalog and data invariants, then rehearse the approved sequence on disposable PostgreSQL 17/Testnet.
4. Resolve the single fulfilled marketplace listing-fee reference that no longer matches a current listing; obtain provider and audit-log evidence before any financial or listing repair.
5. Independently verify the three historical fulfilled membership intents that do not directly link to the current entitlement row; do not modify access without provider evidence.
6. Review and, if approved, apply the six-table client-SELECT revocation proposal on Testnet first. Mainnet requires separate explicit approval and a separate target-specific readiness review.
7. Install dependencies using the supported Node 24.15.x environment, then run `npm ci`, TypeScript, ESLint, production build, browser tests, real Pi Browser authentication and two-account Testnet acceptance.
8. Re-audit Mainnet target identity. It currently has no public application schema or migration history; do not initialize it until the correct project/branch and deployment topology are confirmed.

**Release decision:** Source-level remediation is improved and the focused static gates pass. Database migration readiness, provider evidence, supported-runtime build and end-to-end acceptance remain incomplete. **Do not deploy this archive to Production or apply migrations to Mainnet.**
