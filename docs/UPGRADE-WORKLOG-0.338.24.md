# GreenHaven 0.338.24 — Run #258 live Marketplace RPC repair

## Source and scope

Derived from the user's uploaded `GREENHAVEN-0.338.23-RUN257-ECONOMY-MARKETPLACE-RECONCILIATION.zip`. This increment addresses a live Testnet defect reproduced directly against the database. It does not alter Mainnet, marketplace orders, inventory, balances, payment intents, payouts or provider payments.

## Confirmed live root cause

The Vercel runtime error cluster showed `listOrdersForUserDurable` failing on `GET /api/marketplace/orders`. Calling the Testnet RPC directly from a read-only SQL diagnostic reproduced PostgreSQL `42703`: the old `gh_marketplace_orders_list_for_user` function ordered its outer JSON aggregation by `x.created_at`, although its SELECT exposed the timestamp under the quoted alias `"createdAt"`. The same function source exists in the older Marketplace commerce migration and canonical install SQL.

## Delivered and applied to Testnet

- Added `supabase/migrations/20261110110002_marketplace_orders_list_rpc_alias_fix.sql`.
- The replacement uses the existing `gh_marketplace_order_get` projection, orders by the real `created_at` source column, caps results at 200, rejects empty/oversized IDs, pins `search_path` to `pg_catalog, public`, and preserves SECURITY DEFINER / service-role-only execution.
- Applied only to Testnet project `tpckwgdsjlkzscjlxiwe` through the Supabase migration tool. Supabase recorded generated migration history version `20261110102610`, name `marketplace_orders_list_rpc_alias_fix`.
- Read-only postflight: synthetic non-user lookup returned `[]`; function is SECURITY DEFINER with `search_path=pg_catalog, public`; anon/authenticated EXECUTE are false and service_role EXECUTE is true.
- PostgREST log confirms a schema-cache reload at `2026-11-10T10:26:10Z` and a successful load of 140 relations, 65 relationships and 285 RPCs.
- The fix is compatible with the existing non-variant order schema. It is independent of and does not promote Marketplace migrations 194–195; those remain held pending disposable PostgreSQL and inventory/payment/fulfilment concurrency tests.

## Withdrawal RPC postflight

- Testnet migration history includes `withdrawal_rpc_acl_and_recovery_atomicity` (generated version `20261110085344`).
- `gh_withdrawal_pin_recovery_get` now exists and a synthetic non-user SQL probe returns `{ok:true, configured:false}`.
- `gh_pi_earnings_payout_get_owned` exists and a synthetic non-user request probe returns `REQUEST_NOT_FOUND` as expected.
- Both functions are SECURITY DEFINER, pinned to `pg_catalog, public`, executable by `service_role` only, and denied to anon/authenticated.
- The prior Vercel PGRST202 PIN recovery error predates the migration/schema-cache reload. This is strong evidence that the database-side missing-RPC issue is repaired; authenticated Vercel end-to-end recovery still requires deployment of the current source and an authorized operator test.
- Historical `SUPABASE_HTTP_403` withdrawal errors remain a separate deployment-side verification item. Do not assume that database function ACL alone proves the Vercel service-role key targets this exact project.

## Verification and limits

The Run #258 regression is covered by source-level verification; this does not substitute for dependency-backed build or authenticated end-to-end acceptance. The project requires Node.js 24.15.0.

- Run #258 source contract: 9/9.
- Full `npm run verify:static`: PASS, exit 0; all 287 retained prebuild checks are preserved.
- Migration source manifest: 207/207; SQL lexical integrity: 207/207; migration inventory `--check`: PASS.
- Project truth: 11/11; Phase 12 final integration/release readiness: PASS.
- Curation intelligence refresh was executed for a synthetic non-user identity inside a rolled-back subtransaction; it passed, and all generated snapshot/history writes were rolled back. The earlier curation SQLSTATE 42703 runtime errors are historical; this synthetic probe does not substitute for authenticated user curation acceptance.
- Full `npm run verify:static`: rerun for this source increment; results recorded in the release notes after completion.
- Live Testnet function execution and ACL were verified using synthetic identities only. No actual order, payout, payment or user recovery record was read or changed.
- Vercel's current `testnet` branch/deployment still reports 0.338.20. This 0.338.24 source archive has not been pushed to GitHub or deployed by this worklog.
- Node 24.15.0 dependency-backed typecheck/lint/build and authenticated two-account marketplace, Pi provider and browser/device acceptance remain outstanding. The available local runtime is Node 22.16.0 with no `node_modules`.
- Mainnet remains untouched. Production remains **NOT APPROVED**.
