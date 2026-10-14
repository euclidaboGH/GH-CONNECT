# GreenHaven — Migration Checklist (authoritative inventory)

**Generated:** 2026-10-09T20:54:04Z  
**Canonical path:** `supabase/migrations/*.sql`  
**On-disk count:** **70**  
**Classification:** REQUIRED **67** · REQUIRES_APPROVAL **1** · PROPOSAL **2**

This document is the **source inventory**. It does **not** mean migrations are applied to Testnet or Production.

Do **not** drop tables, disable RLS, or run all files blindly.

---

## Apply policy

| Class | Action |
|-------|--------|
| **REQUIRED** | Apply **oldest → newest** on Testnet after operator confirms prerequisites |
| **REQUIRES_APPROVAL** | Product + security review, then explicit approve |
| **PROPOSAL** | **Do not apply** without written approval |

---

## Staging order (REQUIRED groups, oldest first)

1. **Foundation economy / ledger / claims / membership / Pi intents** (20260821 → 20260905 activity governor)
2. **Auth / Pi identities / sessions / WebAuthn** (20260908*)
3. **Wallet snapshot + marketplace** (20260911 → 20260912)
4. **Verification + messaging + profiles** (20260914 → 20260919)
5. **Stage pending + ledger ACL + communities + social core + polls** (20260922 → 20260925)
6. **Withdrawal + reactions + attention + curation + reputation + ads + creator** (20260926 → 20260930)
7. **Media / follow / notifications / search / shares / messaging prefs / archive** (20261001 → 20261008)
8. **Balance lock / spendable / withdrawal settle / activity stage** (20261009 → 20261012)
9. **GHPV judgment → weight → calibration → settlement infra → soft-delete** (20261013 → 20261020)
10. **Notification types extend + content rewards tables** (20261021 → 20261022)

**Notes on groups 8–10:**

- `20261009`–`20261012` harden balance concurrency; apply only after core ledger RPCs exist.
- GHPV (`20261013`–`20261020`) is **judgment / weight / settlement infrastructure**. Votes must **not** mint GHC. Settlement is **system-only** (not a client action).
- `20261022` content rewards creates accrual tables; distribution to ledger is a **separate** economy path.

---

## Full inventory

| # | File | Class | Notes |
|--:|------|-------|-------|
| 1 | `20260821_ghc_economy_ledger.sql` | REQUIRED |  |
| 2 | `202608220001_ghc_economy_events_rls.sql` | REQUIRED |  |
| 3 | `202608220002_ghc_notification_events.sql` | REQUIRED |  |
| 4 | `202608220003_ghc_public_identities.sql` | REQUIRED |  |
| 5 | `202608220004_ghc_rls_tighten_events.sql` | REQUIRED |  |
| 6 | `202608220005_ghc_transfer_request_rpcs.sql` | REQUIRED |  |
| 7 | `20260822_ghc_account_and_claim.sql` | REQUIRED |  |
| 8 | `202609030001_economy_v12_claim_streak_and_population.sql` | REQUIRED |  |
| 9 | `202609030002_economy_v12_atomic_daily_claim.sql` | REQUIRED |  |
| 10 | `202609030003_economy_v12_telemetry_note.sql` | REQUIRED |  |
| 11 | `202609040001_ghc_ledger_spend_rpc.sql` | REQUIRED |  |
| 12 | `202609040002_membership_entitlements_and_activity_caps.sql` | REQUIRED |  |
| 13 | `202609040003_pi_payment_intents_durable.sql` | REQUIRED |  |
| 14 | `202609050001_p0_activity_governor_durable.sql` | REQUIRED |  |
| 15 | `20260905_connection_request_intents.sql` | REQUIRES_APPROVAL | Do not auto-apply |
| 16 | `20260906_community_join_reasons_proposal.sql` | PROPOSAL | Proposal only |
| 17 | `20260907_community_governance_log_proposal.sql` | PROPOSAL | Proposal only |
| 18 | `202609080001_ghc_spend_sign_and_idempotency.sql` | REQUIRED |  |
| 19 | `202609080002_gh_pi_identities.sql` | REQUIRED |  |
| 20 | `202609080003_gh_sessions.sql` | REQUIRED |  |
| 21 | `202609080004_gh_step_ups.sql` | REQUIRED |  |
| 22 | `202609080005_gh_webauthn_credentials.sql` | REQUIRED |  |
| 23 | `20260911_ghc_wallet_snapshot.sql` | REQUIRED |  |
| 24 | `202609120001_marketplace_listings_and_list_rpc.sql` | REQUIRED |  |
| 25 | `202609120002_marketplace_orders_durable.sql` | REQUIRED |  |
| 26 | `20260914_verification_requests_durable.sql` | REQUIRED |  |
| 27 | `202609190001_gh_messaging_durable.sql` | REQUIRED | Durable messaging (feature-flag gated in app) |
| 28 | `202609190002_gh_user_profiles_and_progress.sql` | REQUIRED |  |
| 29 | `202609220001_ghc_stage_pending.sql` | REQUIRED |  |
| 30 | `202609220002_ghc_stage_pending_limits.sql` | REQUIRED |  |
| 31 | `202609230001_ghc_ledger_rpc_acl.sql` | REQUIRED |  |
| 32 | `202609230002_ghc_user_accounts_rls_lockdown.sql` | REQUIRED |  |
| 33 | `202609230003_gh_communities_core.sql` | REQUIRED |  |
| 34 | `202609230004_gh_pass5_soft_limits_polls.sql` | REQUIRED |  |
| 35 | `202609230005_gh_poll_vote_validate.sql` | REQUIRED |  |
| 36 | `202609230006_gh_social_core.sql` | REQUIRED |  |
| 37 | `202609250001_gh_poll_vote_authoritative.sql` | REQUIRED |  |
| 38 | `202609250002_gh_post_list_feed_order_fix.sql` | REQUIRED |  |
| 39 | `202609250003_rpc_acl_lockdown.sql` | REQUIRED |  |
| 40 | `202609260001_ghc_withdrawal_requests.sql` | REQUIRED |  |
| 41 | `202609260002_gh_reaction_multi_type.sql` | REQUIRED |  |
| 42 | `202609270001_gh_content_attention_read.sql` | REQUIRED |  |
| 43 | `202609270002_gh_content_events.sql` | REQUIRED |  |
| 44 | `202609270003_gh_content_event_access_guard.sql` | REQUIRED |  |
| 45 | `20260928_gh_post_curation.sql` | REQUIRED |  |
| 46 | `20260929_gh_reputation.sql` | REQUIRED |  |
| 47 | `202609300001_gh_creator_studio.sql` | REQUIRED |  |
| 48 | `20260930_gh_ad_verification.sql` | REQUIRED |  |
| 49 | `20261001_gh_media_assets.sql` | REQUIRED |  |
| 50 | `20261002_gh_follow_status.sql` | REQUIRED |  |
| 51 | `20261003_gh_social_notifications.sql` | REQUIRED |  |
| 52 | `20261004_gh_search.sql` | REQUIRED |  |
| 53 | `20261005_gh_post_shares.sql` | REQUIRED |  |
| 54 | `20261006_gh_notif_share_type.sql` | REQUIRED |  |
| 55 | `20261007_gh_messaging_edit_pin_prefs.sql` | REQUIRED | Durable messaging (feature-flag gated in app) |
| 56 | `20261008_gh_post_archive_quote.sql` | REQUIRED |  |
| 57 | `20261009_ghc_balance_lock_and_spendable.sql` | REQUIRED | Shared balance lock / spendable |
| 58 | `20261010_ghc_withdrawal_settle_atomic.sql` | REQUIRED | Atomic withdrawal settle |
| 59 | `20261011_ghc_activity_stage_atomic.sql` | REQUIRED |  |
| 60 | `20261012_ghc_activity_stage_lock_align.sql` | REQUIRED |  |
| 61 | `20261013_ghpv_judgment_infrastructure.sql` | REQUIRED | GHPV infra; no client mint; settlement system-only |
| 62 | `20261014_ghpv_curation_weight_and_settle.sql` | REQUIRED | GHPV infra; no client mint; settlement system-only |
| 63 | `20261015_ghpv_curator_calibration_apply.sql` | REQUIRED | GHPV infra; no client mint; settlement system-only |
| 64 | `20261016_ghpv_active_weight_set_semantics.sql` | REQUIRED | GHPV infra; no client mint; settlement system-only |
| 65 | `20261017_ghpv_settlement_engine.sql` | REQUIRED | GHPV infra; no client mint; settlement system-only |
| 66 | `20261018_ghpv_calibration_bounds.sql` | REQUIRED | GHPV infra; no client mint; settlement system-only |
| 67 | `20261019_ghpv_soft_delete_quality_cleanup.sql` | REQUIRED | GHPV infra; no client mint; settlement system-only |
| 68 | `20261020_ghpv_soft_delete_atomic.sql` | REQUIRED | GHPV infra; no client mint; settlement system-only |
| 69 | `20261021_gh_social_notifications_types_extend.sql` | REQUIRED |  |
| 70 | `20261022_gh_content_rewards.sql` | REQUIRED | Accrual tables; votes do not mint GHC |

---

## Non-REQUIRED files (detail)

### REQUIRES_APPROVAL (1)

- `20260905_connection_request_intents.sql`

### PROPOSAL (2) — do not apply by default

- `20260906_community_join_reasons_proposal.sql`
- `20260907_community_governance_log_proposal.sql`

---

## Post-apply verification (SQL examples — operator runs on Testnet)

```sql
select to_regclass('public.ghc_user_accounts');
select to_regclass('public.gh_pi_identities');
select to_regclass('public.gh_sessions');
select to_regclass('public.gh_posts');
select to_regclass('public.gh_post_shares');
select to_regclass('public.gh_social_notifications');
select to_regclass('public.gh_content_quality_state');  -- GHPV
select to_regclass('public.gh_content_rewards');        -- content rewards
```

Also: `GET /api/health` → identity / session / supabase config flags.

---

## Related docs

- `docs/MIGRATION_GAP_REPORT.md` — Phase 14A gap analysis (no live DB)
- `docs/TESTNET_VERIFICATION_GATE.md` — Testnet procedure
- `docs/DEFERRED_AND_GATED.md` — fail-closed surfaces
- `scripts/print-migration-checklist.mjs` — regenerate console inventory

**Supersedes** older counts of 54 migrations in prior manifests.
