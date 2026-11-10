# GreenHaven migration dependency and ordering audit

**Source release:** 0.338.13  
**Audit date:** 2026-11-09  
**Status:** Step 3 in progress — targeted dependency chains reviewed; full 199-file graph and PostgreSQL rehearsal remain open.

## Scope and safety

This is a source-only dependency review. It does not connect to Supabase, inspect remote migration history, or apply SQL. The canonical review inventory remains `supabase/TESTNET_APPLY_ORDER.md`; its lexical ordering is not deployment approval. Any dependency or approval hold takes precedence over that display order.

## Corrected dependency declarations

| Migration | Required in-repository predecessors | Result |
|---|---|---|
| `20261022010031_ghc_ledger_rpc_acl.sql` | `20261022010001_ghc_economy_ledger.sql` | PASS — target function signatures exist before ACL changes. Later `CREATE OR REPLACE` retains the existing function ACL. Historical 20260821/20260822 references were stale and removed. |
| `20261022010062_ghpv_curation_weight_and_settle.sql` | `20261022010061_ghpv_judgment_infrastructure.sql` | PASS — judgment/quality state tables precede the GHPV curation functions. |
| `20261022010066_ghpv_curator_calibration_apply.sql` | `20261022010061_ghpv_judgment_infrastructure.sql` | PASS — calibration table is created by the canonical infrastructure migration; stale 20261013 reference removed. |
| `20261022010067_ghpv_active_weight_set_semantics.sql` | `20261022010036_gh_social_core.sql`; `20261022010045_gh_post_curation.sql`; `20261022010061_ghpv_judgment_infrastructure.sql`; `20261022010062_ghpv_curation_weight_and_settle.sql` | PASS — posts, curations, quality state and the function contract being replaced are ordered earlier. Stale 20261013/20261014 references removed. |
| `20261022010068_ghpv_settlement_engine.sql` | `20261022010036_gh_social_core.sql`; `20261022010045_gh_post_curation.sql`; `20261022010061_ghpv_judgment_infrastructure.sql`; `20261022010062_ghpv_curation_weight_and_settle.sql`; `20261022010066_ghpv_curator_calibration_apply.sql`; `20261022010067_ghpv_active_weight_set_semantics.sql` | PASS — all referenced canonical tables and helper RPCs precede the settlement engine. Contradictory external 20261013–20261016 deployment note removed. Remains REVIEW_REQUIRED for runtime contract and clean-database testing. |
| `20261028160000_marketplace_buyer_confirmation_delivery_gate.sql` | `20261022130001_marketplace_commerce_v2.sql` | PASS — explicit predecessor exists and sorts earlier. |
| `20261107130001_wallet_security_hardening.sql` | `20261030010002_pi_earnings_payout_requests.sql`; `20261105170001_phase3_earnings_ledger_integrity_hardening.sql`; `20261105200001_withdrawal_pin_security.sql`; `20261107120001_withdrawal_pin_recovery_questions.sql` | PASS — payout request table, authoritative reserve-release function and PIN tables precede the hardening migration. |
| `20261108150001_repair_pin_storage_and_payout_release.sql` | `20261030010002_pi_earnings_payout_requests.sql`; `20261105170001_phase3_earnings_ledger_integrity_hardening.sql`; `20261105200001_withdrawal_pin_security.sql`; `20261107120001_withdrawal_pin_recovery_questions.sql`; `20261107130001_wallet_security_hardening.sql`; `20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql` | PASS — the request table, release RPC and earlier PIN/payout functions precede the repair that deliberately supersedes them. |
| `20261109100001_gh_messaging_phase1_controls_search.sql` | `20261022010027_gh_messaging_durable.sql`; `20261022010055_gh_messaging_edit_pin_prefs.sql`; `20261022010105_gh_messaging_presence_delivery_receipts.sql`; `20261023010003_gh_messaging_v2.sql` | PASS — conversation/member/message tables, pin/archive fields, receipt table and context extensions precede the closeout migration. |

## Corrections made during this pass

1. Replaced stale external migration references in the GHC ACL and GHPV dependency comments with canonical in-repository predecessors.
2. Documented the full prerequisite chain for the wallet hardening and subsequent repair migrations, including the payout request table and authoritative reserve-release function.
3. Added explicit messaging prerequisites for the durable base tables, member controls, receipt table and V2 schema extensions.
4. Regenerated `MIGRATION-SOURCE-MANIFEST.csv`, `VERIFIED_MANIFEST.txt`, and `supabase/TESTNET_APPLY_ORDER.md` after SQL byte changes.

## Remaining dependency gate

- Continue dependency tracing across every migration, including dynamically referenced functions, views, types, triggers, extensions, storage buckets/policies, Auth objects, Realtime publication membership and scheduled/background jobs.
- Identify any external historical prerequisites that are not created by this repository and prove whether they are platform prerequisites, superseded comments, or genuine missing migrations.
- Verify every dependency against a fresh PostgreSQL catalog, not only filename order or source text.
- Do not use the generated review order as an apply script and do not apply migrations until Step 4 clean-database rehearsal passes.

## Execution environment limitation

No `psql`, PostgreSQL server binaries, `initdb`, Docker, `pg_format`, `sqlfluff`, or `pglast` parser are available in this audit runtime. Therefore no SQL migration has been executed or parsed by a PostgreSQL engine in this pass. The source-level checks below are not substitutes for PostgreSQL execution.
