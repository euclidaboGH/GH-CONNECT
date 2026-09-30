# Supabase migration checklist (operator)

**Never** drop production tables to “fix” identity or ledger data.  
**Never** disable RLS in Production for debugging.

| Item | Value |
|------|------:|
| Canonical directory | `supabase/migrations/` |
| On-disk count | **54** |
| Latest sequence id | `20261006_gh_notif_share_type.sql` |

Copies under `staging-required-migrations/` / `staging-gap-package/` are **not** additional canonical migrations.

Filenames are **sequence ids** (ordering), not necessarily calendar deployment dates.

Machine listing: `node scripts/print-migration-checklist.mjs`

---

## Classification legend

| Class | Operator action |
|-------|-----------------|
| **REQUIRED** | Apply on Testnet (then Production when ready), oldest → newest |
| **REQUIRES_APPROVAL** | Apply only after product/security review |
| **PROPOSAL** | Do **not** apply unless explicitly approved |

There are **no Phase 14 or Phase 15** migrations in this repository.

---

## Full inventory (54)

| # | File | Class | Purpose (from migration header) |
|--:|------|-------|----------------------------------|
| 1 | `20260821_ghc_economy_ledger.sql` | REQUIRED | GHC authoritative ledger |
| 2 | `20260822_ghc_account_and_claim.sql` | REQUIRED | Account created_at + claim pending GHC |
| 3 | `202608220001_ghc_economy_events_rls.sql` | REQUIRED | RLS on economy notification events |
| 4 | `202608220002_ghc_notification_events.sql` | REQUIRED | Economy event notification fields + dedupe |
| 5 | `202608220003_ghc_public_identities.sql` | REQUIRED | Server-authoritative public GH IDs |
| 6 | `202608220004_ghc_rls_tighten_events.sql` | REQUIRED | Tighten economy events SELECT RLS |
| 7 | `202608220005_ghc_transfer_request_rpcs.sql` | REQUIRED | Transfer-request RPCs (atomic accept) |
| 8 | `202609030002_economy_v12_atomic_daily_claim.sql` | REQUIRED | Atomic daily claim (streak + ledger) |
| 9 | `202609030001_economy_v12_claim_streak_and_population.sql` | REQUIRED | Claim/streak authoritative state |
| 10 | `202609030003_economy_v12_telemetry_note.sql` | REQUIRED | Economy v1.2 support notes (non-destructive) |
| 11 | `202609040001_ghc_ledger_spend_rpc.sql` | REQUIRED | Authoritative GHC spend (debit-only) |
| 12 | `202609040002_membership_entitlements_and_activity_caps.sql` | REQUIRED | Membership entitlements + activity caps |
| 13 | `202609040003_pi_payment_intents_durable.sql` | REQUIRED | Durable Pi payment intents |
| 14 | `20260905_connection_request_intents.sql` | **REQUIRES_APPROVAL** | Connection request intent durability |
| 15 | `202609050001_p0_activity_governor_durable.sql` | REQUIRED | Multi-instance activity caps + demand |
| 16 | `20260906_community_join_reasons_proposal.sql` | **PROPOSAL** | Join-reason storage (not auto-apply) |
| 17 | `20260907_community_governance_log_proposal.sql` | **PROPOSAL** | Moderation log + safety reports proposal |
| 18 | `202609080002_gh_pi_identities.sql` | REQUIRED | Durable Pi ↔ GH identity mapping |
| 19 | `202609080003_gh_sessions.sql` | REQUIRED | Server sessions |
| 20 | `202609080004_gh_step_ups.sql` | REQUIRED | Step-up authentication records |
| 21 | `202609080005_gh_webauthn_credentials.sql` | REQUIRED | WebAuthn credential storage |
| 22 | `202609080001_ghc_spend_sign_and_idempotency.sql` | REQUIRED | Spend signing + idempotency |
| 23 | `20260911_ghc_wallet_snapshot.sql` | REQUIRED | Wallet snapshot support |
| 24 | `202609120001_marketplace_listings_and_list_rpc.sql` | REQUIRED | Marketplace listings + list RPC |
| 25 | `202609120002_marketplace_orders_durable.sql` | REQUIRED | Durable marketplace orders |
| 26 | `20260914_verification_requests_durable.sql` | REQUIRED | Verification requests durability |
| 27 | `202609190001_gh_messaging_durable.sql` | REQUIRED | Conversations + messages |
| 28 | `202609190002_gh_user_profiles_and_progress.sql` | REQUIRED | Profiles, progress, achievements |
| 29 | `202609220001_ghc_stage_pending.sql` | REQUIRED | Stage pending GHC |
| 30 | `202609220002_ghc_stage_pending_limits.sql` | REQUIRED | Stage pending limits |
| 31 | `202609230003_gh_communities_core.sql` | REQUIRED | Communities core |
| 32 | `202609230004_gh_pass5_soft_limits_polls.sql` | REQUIRED | Soft limits + polls foundation |
| 33 | `202609230005_gh_poll_vote_validate.sql` | REQUIRED | Poll vote validation |
| 34 | `202609230006_gh_social_core.sql` | REQUIRED | Social core (posts, reactions, follows, …) |
| 35 | `202609230001_ghc_ledger_rpc_acl.sql` | REQUIRED | Ledger RPC ACL |
| 36 | `202609230002_ghc_user_accounts_rls_lockdown.sql` | REQUIRED | `ghc_user_accounts` RLS lockdown |
| 37 | `202609250001_gh_poll_vote_authoritative.sql` | REQUIRED | Authoritative poll vote RPC |
| 38 | `202609250002_gh_post_list_feed_order_fix.sql` | REQUIRED | Feed ORDER BY alias fix (`createdAt`) |
| 39 | `202609250003_rpc_acl_lockdown.sql` | REQUIRED | Global RPC ACL lockdown (service_role) |
| 40 | `202609260002_gh_reaction_multi_type.sql` | REQUIRED | Multi-type durable reactions (Phase 1) |
| 41 | `202609260001_ghc_withdrawal_requests.sql` | REQUIRED | GHC → π withdrawal requests |
| 42 | `202609270001_gh_content_attention_read.sql` | REQUIRED | Attention read model (Phase 2.5) |
| 43 | `202609270003_gh_content_event_access_guard.sql` | REQUIRED | Attention access/visibility guard |
| 44 | `202609270002_gh_content_events.sql` | REQUIRED | Content attention events (Phase 2.2) |
| 45 | `20260928_gh_post_curation.sql` | REQUIRED | Post curation upvote/downvote (Phase 3) |
| 46 | `20260929_gh_reputation.sql` | REQUIRED | Reputation foundation (Phase 4) |
| 47 | `20260930_gh_ad_verification.sql` | REQUIRED | Pi Ads verification events (Phase 6; no rewards) |
| 48 | `202609300001_gh_creator_studio.sql` | REQUIRED | Creator Studio + tip intents (Phase 5; no settlement) |
| 49 | `20261001_gh_media_assets.sql` | REQUIRED | Durable media assets (Phase 8) |
| 50 | `20261002_gh_follow_status.sql` | REQUIRED | Follow status + counts (Phase 10) |
| 51 | `20261003_gh_social_notifications.sql` | REQUIRED | Social notifications (Phase 11) |
| 52 | `20261004_gh_search.sql` | REQUIRED | Server search/discovery (Phase 12) |
| 53 | `20261005_gh_post_shares.sql` | REQUIRED | Durable shares (Phase 13) |
| 54 | `20261006_gh_notif_share_type.sql` | REQUIRED | Share notification type constraint |

**Counts:** REQUIRED **51** · REQUIRES_APPROVAL **1** · PROPOSAL **2** · Total **54**

---

## Recommended apply order (Testnet)

1. REQUIRED rows **1–13** (economy / payments / membership)  
2. Skip or review **14** (`connection_request_intents`)  
3. REQUIRED **15**  
4. **Do not apply 16–17** (PROPOSAL) unless approved  
5. REQUIRED **18–54** (identity → social Phases 1–13)

Always apply **oldest sequence id first** within the set you choose to run.

---

## Post-apply smoke SQL

```sql
select to_regclass('public.gh_pi_identities');
select to_regclass('public.gh_sessions');
select to_regclass('public.gh_user_profiles');
select to_regclass('public.gh_conversations');
select to_regclass('public.gh_posts');
select to_regclass('public.gh_post_shares');
select to_regclass('public.gh_social_notifications');
select to_regclass('public.ghc_payment_intents');
select to_regclass('public.ghc_membership_entitlements');
```

Then: `GET /api/health` and `docs/IDOR_TEST_CHECKLIST.md` on Staging/Testnet before Production.

---

## Implementation vs apply status

| Layer | Status |
|-------|--------|
| SQL files in repo | Present (54) |
| Applied on Testnet Supabase | **Operator action** — not certified by this document |
| Applied on Mainnet Supabase | **Operator action** — not certified by this document |

Source presence ≠ database applied.
