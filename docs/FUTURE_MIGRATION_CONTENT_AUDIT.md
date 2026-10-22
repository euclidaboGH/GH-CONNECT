# Migration Content Review — 2026-10-21

## Scope and limits

Reviewed the four duplicate-version migrations and all 15 files dated after 2026-10-21. Compared their SQL objects with the current application routes, server stores, source regression checks, and project migration dependencies. This is a **static source review**, not a PostgreSQL execution test: this environment has neither the Supabase CLI nor `psql`, and no Testnet/Mainnet migration-history output was available. Therefore this report does not certify SQL syntax against the live schema, remote application state, or provider behavior.

## Duplicate version prefixes — keep both files in each pair

| Prefix | File | Content / assessment |
|---|---|---|
| `202610170001` | `20261022010068_ghpv_settlement_engine.sql` | Adds the authoritative GHPV settlement snapshot and idempotent settlement commit, locks by content, records judgment events and calibration changes. Depends on the 20261013–20261016 GHPV foundation. Distinct and useful. |
| `202610170002` | `20261022010069_match_signals_durable.sql` | Adds durable like/pass/superlike matching signals and an upsert RPC. Separate matching feature; does not duplicate GHPV settlement. Distinct and useful. |
| `202610180012` | `20261022010080_gh_engagement_rosters.sql` | Adds server RPCs for post/story engagement rosters and viewer lists with actor/owner checks and service-role grants. Distinct social feature. |
| `202610170003` | `20261022010070_ghpv_calibration_bounds.sql` | Replaces `gh_ghpv_commit_settlement` to clamp calibration and quality deltas and preserve quarantine. Explicitly depends on the settlement engine above. It is a hardening follow-up, not a duplicate. |

**Decision:** do not delete any of these four. Their local numeric versions have now been made unique: GHPV settlement (`202610170001`), matching signals (`202610170002`), calibration bounds (`202610170003`), and engagement rosters (`202610180012`). This order keeps the calibration hardening after its settlement engine. These renames are appropriate for a clean new Supabase baseline; any existing environment that recorded the old filenames must be reconciled separately before using this archive there.

## Future-dated migration review

| File | Application/code correspondence | Static assessment |
|---|---|---|
| `20261022010101_gh_content_rewards.sql` | `lib/server/content-reward/store.ts`; content reward API/UI; `test-content-reward-boundaries.mjs` | Useful display/state foundation. Correctly separates display totals from ledger settlement and blocks client table access. Keep gated; no reward distribution is enabled by this file alone. |
| `20261022010102_gh_profile_content_library.sql` | `app/api/social/profile/[userId]/posts/route.ts`; profile content library; profile production audit | Useful cursor-paginated, bounded, visibility-aware profile library. Includes either-direction block suppression. Keep; live schema execution and two-user privacy tests still required. |
| `20261022010103_gh_post_reaction_roster_visibility_guard.sql` | `app/api/social/posts/[id]/reactions/list/route.ts`; engagement roster tests | Useful privacy hardening. Allows public, follower-only (when followed), and owner access; currently denies `mutuals` visibility to non-owners even when they are mutuals. This is fail-closed (no disclosure) but overly restrictive if mutuals rosters are expected. |
| `20261022010104_gh_story_creator_upgrade.sql` | `app/api/social/stories/route.ts`; `test-story-creator.mjs` | Useful story-theme persistence and audience filtering. `matches-only` and `private` are intentionally owner-only until canonical match authorization exists. Route derives owner identity from session. Keep; two-account runtime tests required. |
| `20261022010105_gh_messaging_presence_delivery_receipts.sql` | `lib/server/messaging/message-store.ts`; messaging reliability tests | Useful durable per-recipient receipts, unread cursors, privacy preferences, and expiring presence leases. RLS and service-role RPC grants are present. Keep gated on live membership/IDOR and concurrency tests. |
| `20261022010106_gh_story_reactions.sql` | story reaction API and social visibility tests | Useful durable reactions, but the original RPC checked story status/expiry and blocks without checking the story's audience. **Fixed in the local source:** reactions now follow the same `everyone`/`followers`/reciprocal-`friends` visibility rules as story listing; `matches-only`/`private` remain owner-only. Regression checks pass. If this migration has already been applied remotely, editing this historical file will not update the database; a new corrective migration must be made after remote history reconciliation. |
| `20261022010107_gh_post_created_notifications.sql` | post creation and messaging notification paths; notification tests | Useful informational notification RPCs; does not change GHC/Pi/economy state. Keep; validate dedupe and fan-out on Testnet. |
| `20261022010108_gh_system_announcements.sql` | `/api/system/announcements`; system announcement tests | Useful cross-device announcement/read-state storage. RLS deny-all policies protect direct client access; API uses trusted server access. Keep gated on deployment verification. |
| `20261022010109_gh_post_restore_owner_window.sql` | `/api/social/posts/[id]/restore`; post-restore tests | Useful owner-only restore within 30 days; locks the row and explicitly does not restore curation weights or mutate GHC. Keep. |
| `20261022010110_gh_lifecycle_payout_quality_foundation.sql` | account lifecycle and marketplace payout routes; Phase 15 tests | Useful request/queue foundations with no immediate account deletion or external payout. Payout requests require completed/verified orders, full eligible balance, and allocation uniqueness. Keep as a gated foundation, not release approval. |
| `20261022010111_gh_verified_tip_settlement_payout_reconciliation.sql` | tip/payment completion and payout reconciliation routes; Phase 17 tests | Useful durable PI tip settlement and payout evidence/reconciliation. Must remain gated on real provider verification, exact amount/recipient/network binding, and duplicate/concurrency tests. Keep pending live validation. |
| `20261022010112_ghc_tip_and_creator_reward_atomic_settlement.sql` | GHC tip and creator reward admin routes; Phase 19 tests | Useful funded-ledger settlement and reward-pool accounting. Uses existing GHC ledger rather than minting from votes; admin/operator controls remain essential. Keep gated on balance isolation and concurrent settlement tests. |
| `20261022010113_pi_a2u_sdk_execution_orchestration.sql` | Pi A2U create/complete routes; Phase 20 tests | Useful durable idempotent execution ledger and global sequence lease. Testnet/feature gates and provider reconciliation are required; no Mainnet payout approval implied. Keep gated. |
| `20261022010114_ghc_atomic_seller_payout_settlement.sql` | `/api/marketplace/payouts/[requestId]/reconcile-ghc`; Phase 20 tests | Useful funded GHC seller settlement: checks eligible order backing, locks both balances, posts paired ledger entries, records settlement, and marks paid transactionally. Keep disabled until treasury funding and live financial isolation tests pass. |
| `20261022010115_paystack_ngn_beneficiaries_and_payouts.sql` | beneficiary/bank payout APIs and Paystack webhook/reconciliation routes; Phase 22 tests | Useful NGN-only payout foundation with evidence-bound obligations, beneficiary verification, daily limits, signed webhook verification in the API, idempotency, and manual exception handling. Keep gated; do not treat source tests as proof of live provider behavior. |

## Source checks run

- `scripts/test-social-visibility.mjs`: **14/14 passed** after adding regression assertions for story audience enforcement.
- `scripts/test-engagement-roster-security.mjs`: **10/10 passed**.
- `scripts/test-story-creator.mjs`: **12/12 passed**.
- `scripts/test-messaging-reliability.mjs`: **32/32 passed**.
- `scripts/test-content-reward-boundaries.mjs`: **20/20 passed**.
- `scripts/test-system-announcements.mjs`: **15/15 passed**.
- `scripts/test-post-restore.mjs`: **12/12 passed**.
- `scripts/test-phase15-account-payout-quality.mjs`: **25/25 passed**.
- `scripts/test-phase17-media-financial-foundation.mjs`: **18/18 passed**.
- `scripts/test-phase19-financial-media-readiness.mjs`: **29/29 passed**.
- `scripts/test-phase20-payout-adapters.mjs`: **19/19 passed**.
- `scripts/test-phase22-paystack-bank-payouts.mjs`: **42/42 passed**.
- `scripts/audit-profile-production.mjs`: **83/87 passed**; four failures are existing profile UI expectations (dedicated Posts section, 4 MB upload limit, owner-card edit handler, durable-media-first uploads), not proof of a SQL syntax error. They need separate product/source reconciliation.

These are repository source-level regression checks. They do not replace a clean dependency install, TypeScript/lint/build verification, PostgreSQL migration application on an isolated Testnet, two-user authorization tests, provider sandbox tests, or remote migration-history comparison.

## Next safe actions

1. Capture Testnet and Mainnet `supabase migration list` outputs separately and run `scripts/reconcile-remote-migration-histories.mjs`.
2. Once history is known, assign unique migration versions to the two duplicate pairs without deleting either distinct migration; account for the existing 202610180001–202610180011 sequence.
3. If the story-reaction migration is already recorded remotely, create a new forward corrective migration for the audience check rather than editing history only.
4. Validate all candidate migrations on an isolated Testnet schema, then run two-user IDOR/privacy, concurrency, and financial/provider sandbox checks. No Mainnet apply until those gates pass.
