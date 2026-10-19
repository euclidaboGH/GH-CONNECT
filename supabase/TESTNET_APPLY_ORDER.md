# Testnet Supabase — migration apply order

**Authoritative policy: `docs/MIGRATION_CHECKLIST.md`.** Do **not** apply every file blindly.
Apply the REQUIRED files **oldest → newest** (filename sort order). Skip PROPOSAL files and
get explicit approval before applying REQUIRES_APPROVAL files.

If the Testnet project shows **No migrations** / `gh_pi_identities` 404, the early auth tables
have not been applied. The critical early files are:

1. `202609080002_gh_pi_identities.sql`
2. `202609080003_gh_sessions.sql`
3. `202609190002_gh_user_profiles_and_progress.sql`
4. `202609190001_gh_messaging_durable.sql` (keep durable messaging off until IDOR gates pass)

The last ACL hardening before the later feature migrations is `202609250003_rpc_acl_lockdown.sql`
(preceded by `202609250001_gh_poll_vote_authoritative.sql` and
`202609250002_gh_post_list_feed_order_fix.sql`).

> Earlier revisions of this file listed old filenames (for example `20260908_gh_sessions.sql`).
> Those files do not exist; the names above are the real ones on disk.

GHPV migrations `20261013`–`20261020` are repository-only until Testnet; settlement is
system-only and votes must not mint GHC (see `README.md`).

## Selected operational apply sequence (75 listed entries; see `docs/MIGRATION_CHECKLIST.md` for the complete classified inventory)

| # | File | Action |
|---|------|--------|
| 1 | `20260821_ghc_economy_ledger.sql` | apply |
| 2 | `202608220001_ghc_economy_events_rls.sql` | apply |
| 3 | `202608220002_ghc_notification_events.sql` | apply |
| 4 | `202608220003_ghc_public_identities.sql` | apply |
| 5 | `202608220004_ghc_rls_tighten_events.sql` | apply |
| 6 | `202608220005_ghc_transfer_request_rpcs.sql` | apply |
| 7 | `20260822_ghc_account_and_claim.sql` | apply |
| 8 | `202609030001_economy_v12_claim_streak_and_population.sql` | apply |
| 9 | `202609030002_economy_v12_atomic_daily_claim.sql` | apply |
| 10 | `202609030003_economy_v12_telemetry_note.sql` | apply |
| 11 | `202609040001_ghc_ledger_spend_rpc.sql` | apply |
| 12 | `202609040002_membership_entitlements_and_activity_caps.sql` | apply |
| 13 | `202609040003_pi_payment_intents_durable.sql` | apply |
| 14 | `202609050001_p0_activity_governor_durable.sql` | apply |
| 15 | `20260905_connection_request_intents.sql` | **needs approval — do not auto-apply** |
| 16 | `20260906_community_join_reasons_proposal.sql` | **proposal — do not apply** |
| 17 | `20260907_community_governance_log_proposal.sql` | **proposal — do not apply** |
| 18 | `202609080001_ghc_spend_sign_and_idempotency.sql` | apply |
| 19 | `202609080002_gh_pi_identities.sql` | apply |
| 20 | `202609080003_gh_sessions.sql` | apply |
| 21 | `202609080004_gh_step_ups.sql` | apply |
| 22 | `202609080005_gh_webauthn_credentials.sql` | apply |
| 23 | `20260911_ghc_wallet_snapshot.sql` | apply |
| 24 | `202609120001_marketplace_listings_and_list_rpc.sql` | apply |
| 25 | `202609120002_marketplace_orders_durable.sql` | apply |
| 26 | `20260914_verification_requests_durable.sql` | apply |
| 27 | `202609190001_gh_messaging_durable.sql` | apply |
| 28 | `202609190002_gh_user_profiles_and_progress.sql` | apply |
| 29 | `202609220001_ghc_stage_pending.sql` | apply |
| 30 | `202609220002_ghc_stage_pending_limits.sql` | apply |
| 31 | `202609230001_ghc_ledger_rpc_acl.sql` | apply |
| 32 | `202609230002_ghc_user_accounts_rls_lockdown.sql` | apply |
| 33 | `202609230003_gh_communities_core.sql` | apply |
| 34 | `202609230004_gh_pass5_soft_limits_polls.sql` | apply |
| 35 | `202609230005_gh_poll_vote_validate.sql` | apply |
| 36 | `202609230006_gh_social_core.sql` | apply |
| 37 | `202609250001_gh_poll_vote_authoritative.sql` | apply |
| 38 | `202609250002_gh_post_list_feed_order_fix.sql` | apply |
| 39 | `202609250003_rpc_acl_lockdown.sql` | apply |
| 40 | `202609260001_ghc_withdrawal_requests.sql` | apply |
| 41 | `202609260002_gh_reaction_multi_type.sql` | apply |
| 42 | `202609270001_gh_content_attention_read.sql` | apply |
| 43 | `202609270002_gh_content_events.sql` | apply |
| 44 | `202609270003_gh_content_event_access_guard.sql` | apply |
| 45 | `20260928_gh_post_curation.sql` | apply |
| 46 | `20260929_gh_reputation.sql` | apply |
| 47 | `202609300001_gh_creator_studio.sql` | apply |
| 48 | `20260930_gh_ad_verification.sql` | apply |
| 49 | `20261001_gh_media_assets.sql` | apply |
| 50 | `20261002_gh_follow_status.sql` | apply |
| 51 | `20261003_gh_social_notifications.sql` | apply |
| 52 | `20261004_gh_search.sql` | apply |
| 53 | `20261005_gh_post_shares.sql` | apply |
| 54 | `20261006_gh_notif_share_type.sql` | apply |
| 55 | `20261007_gh_messaging_edit_pin_prefs.sql` | apply |
| 56 | `20261008_gh_post_archive_quote.sql` | apply |
| 57 | `20261009_ghc_balance_lock_and_spendable.sql` | apply |
| 58 | `20261010_ghc_withdrawal_settle_atomic.sql` | apply |
| 59 | `20261011_ghc_activity_stage_atomic.sql` | apply |
| 60 | `20261012_ghc_activity_stage_lock_align.sql` | apply |
| 61 | `20261013_ghpv_judgment_infrastructure.sql` | apply |
| 62 | `20261014_ghpv_curation_weight_and_settle.sql` | apply |
| 63 | `20261015_ghpv_curator_calibration_apply.sql` | apply |
| 64 | `20261016_ghpv_active_weight_set_semantics.sql` | apply |
| 65 | `20261017_ghpv_settlement_engine.sql` | apply |
| 66 | `202610180001_ghc_curation_rewards.sql` | apply after review; testnet only; requires the existing economy ledger, spendable-balance RPC, reputation state, and curation schema |
| 67 | `202610180002_gh_curation_pipeline_atomic.sql` | apply after 66; testnet only; atomically wires vote, reward decision, and GHPV active weight |
| 68 | `20261018_ghpv_calibration_bounds.sql` | apply |
| 69 | `20261019_ghpv_soft_delete_quality_cleanup.sql` | apply |
| 70 | `20261020_ghpv_soft_delete_atomic.sql` | apply |
| 71 | `20261021_gh_social_notifications_types_extend.sql` | apply |
| 72 | `20261022_gh_content_rewards.sql` | apply |
| 73 | `20261023_gh_profile_content_library.sql` | apply after review |
| 74 | `202610240003_gh_post_reaction_roster_visibility_guard.sql` | apply after review |
| 75 | `202610240004_gh_story_creator_upgrade.sql` | apply after review |
| 76 | `202610240005_gh_messaging_presence_delivery_receipts.sql` | apply after review; follow `supabase/MESSAGING_PRESENCE_DEPLOY.md` and test two accounts |
| 77 | `202610240006_gh_story_reactions.sql` | apply after review; adds durable story reactions and counts; verify owner/self-reaction and blocked-user protections |
| 78 | `202610240007_gh_post_created_notifications.sql` | apply after review; durable post-created notifications |
| 79 | `202610180003_reputation_event_integrity.sql` | apply after 202610180002; testnet only; requires gh_reputation_events |
| 80 | `202610180004_curation_self_vote_guard.sql` | apply after 202610180003; testnet only; self-curation rejected |

## After apply (read-only checks)

```sql
SELECT to_regclass('public.gh_pi_identities') AS pi_identities;
SELECT to_regclass('public.gh_sessions') AS sessions;
SELECT to_regclass('public.ghc_payment_intents') AS payment_intents;
SELECT to_regclass('public.ghc_membership_entitlements') AS membership;
SELECT to_regclass('public.gh_posts') AS posts;
SELECT to_regclass('public.gh_communities') AS communities;

-- RPC should NOT be executable by anon after ACL lockdown
SELECT has_function_privilege('anon', 'public.gh_community_join(text,text)', 'execute') AS anon_can_join;
-- expect: false
```

## Vercel Preview

Point Preview env at this Testnet Supabase + Testnet Pi credentials (`NEXT_PUBLIC_PI_SANDBOX=true`). For the messaging reliability upgrade, set `NEXT_PUBLIC_MESSAGING_DURABLE=true` in Preview after the new migration is applied, then follow `supabase/MESSAGING_PRESENCE_DEPLOY.md` before enabling it in Production.


## Reputation and curation integrity follow-up (release 0.60.6)

After confirming the prerequisites and that migrations `202610180001_ghc_curation_rewards.sql` and `202610180002_gh_curation_pipeline_atomic.sql` have been applied successfully to **testnet**, apply `202610180003_reputation_event_integrity.sql`. This final migration depends on `gh_reputation_events` from `20260929_gh_reputation.sql`. It adds a trigger to enforce the canonical point values on reputation events. Verify with the new `scripts/test-reputation-curation-integrity.mjs` and then perform live multi-account tests. Do not apply to mainnet as part of this step. The previous self-vote restriction is superseded by `202610180005_allow_self_curation.sql`: creators may self-curate for encouragement, but this must never qualify as independent settlement evidence or generate GHC/reputation. Apply 004 then 005 on testnet in order, and verify author self-curation toggles correctly, does not create reward claims, and is excluded from any independent-reviewer threshold. The TypeScript and SQL reputation thresholds were also made progressively harder; validate rank parity on testnet. Do not apply these migrations to mainnet without a separate approved rollout.


## Phase 20 additions — review separately; do not bulk-apply

- `202610250006_pi_a2u_sdk_execution_orchestration.sql`: durable Pi A2U execution and a global sequence lease. Requires `pi-backend` installed, server-only Pi API key/wallet seed, and a Testnet test plan. The route remains disabled until the exact target schema and provider flow pass.
- `202610250007_ghc_atomic_seller_payout_settlement.sql`: atomic funded GHC seller payouts from an explicitly configured treasury. It checks eligible completed/verified order allocations and actual spendable GHC. Keep the route disabled until the treasury account and reserve are independently reviewed and funded.
- Run `supabase/phase20_readonly_preflight.sql` first; compare its migration-history and object results with the actual Supabase project's migration history. After reviewed application, run `supabase/tests/PHASE20_POST_MIGRATION_ASSERTIONS.sql` and follow `supabase/tests/PHASE20_CONCURRENCY_TEST_PLAN.md` on disposable PostgreSQL and Pi Testnet.
- Do not apply migrations 006/007 based solely on this repository inventory. No live database was accessed or modified during source work.

## Phase 22 additions — review separately; do not bulk-apply

- `202610250008_paystack_ngn_beneficiaries_and_payouts.sql`: adds Paystack NGN beneficiaries, evidence-backed NGN payout obligations, idempotent payout requests, UTC daily limits, signed webhook evidence, provider reconciliation, and audited exception handling. Classify as **REVIEW_REQUIRED**; validate in disposable PostgreSQL and Paystack Test Mode.
- Run `supabase/phase22_readonly_preflight.sql` before any apply. After a reviewed disposable/Testnet apply, run `supabase/tests/PHASE22_POST_MIGRATION_ASSERTIONS.sql` and follow `supabase/tests/PHASE22_PAYSTACK_BANK_PAYOUT_TEST_PLAN.md`.
- Existing GHC/PI marketplace orders are not NGN revenue. Do not create NGN obligations from GHC/PI orders, and do not enable bank transfers until a verified NGN revenue source, provider approval, limits, webhook and reconciliation gates have passed.
- Use `supabase/phase20_ghc_treasury_readonly_preflight.sql` only after its prerequisite migrations are confirmed. A positive balance alone does not prove approved treasury funding; governance/source evidence must be reviewed independently.
- None of these migrations has been applied to the user's Supabase project during this source-code phase.
