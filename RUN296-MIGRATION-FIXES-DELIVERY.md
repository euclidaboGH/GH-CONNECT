# GreenHaven 0.338.56 — Migration fixes (Phase 9.3 and dependency guards)

Applies on top of the Run #296 onboarding delivery. No application code changed.

## Phase 9.3 (`20261107180001_marketplace_sku_variants_atomic_inventory.sql`)
1. **Syntax error fixed.** The `IF` guard in `gh_marketplace_variants_replace` contained a `CASE ... THEN`; plpgsql ends an `IF` condition at the first `THEN`, producing `42601 syntax error at end of input`. The array-type check and the 100-item limit are now separate `IF` statements.
2. **Re-runnable.** The legacy-RPC rename guard no longer raises `MARKETPLACE_RESERVED_RPC_RENAME_STATE_CONFLICT` when both the wrapper and `_pre_variant` already exist.
3. **Idempotency replay.** `existing.variant_id <> p_variant_id` became `IS DISTINCT FROM`, so a non-variant order key cannot be replayed through the variant RPC as a success.
4. **`active` validation.** A non-boolean `active` is rejected as `INVALID_VARIANT` before any write.

## Call migrations (20261111064321, 20261111064446, 20261111064542)
Each now starts with a guard that fails with `GH_CALL_TABLES_MISSING` unless `public.gh_call_sessions` and `public.gh_call_signals` exist (they are created only by `supabase/proposals/20261111090001_direct_call_sessions_proposal.sql`, which is not part of the migration chain).

## Required apply order for an existing database
1. `20261107180001` (Phase 9.3)
2. `20261107190001` (Phase 9.4) — **re-run it after 9.3**: both redefine `gh_marketplace_order_get` and `gh_marketplace_orders_list_for_user`, and 9.3 holds the older shape without tracking fields.
3. `20261110110002` (list RPC alias fix) — re-run if previously applied, for the same reason.
Confirm `gh_marketplace_orders.variant_id` exists (the 9.4 event trigger reads it).

## Verification
- Disposable PostgreSQL 16 rehearsal: 193 preceding migrations apply; fixed 9.3 applies and re-runs three times; 9.4 and list-fix re-run cleanly.
- Behaviour tested: membership downgrade guard (reject active VVIP→VIP; allow expiry, revocation, upgrade, expired VVIP→VIP); variant stock reserve / cancel release / payment commit / oversell refusal / legacy-path block.
- Static checks pass: phase93 (26/26), phase94 (28/28), run257, SQL lexical integrity, migration manifest, project truth, phase23 integrity, run296 onboarding.
- Not done: full TypeScript/ESLint/Next build (Node 24 required), Phase 9.4 functional tests, Pi Browser acceptance. Production remains NOT APPROVED.
