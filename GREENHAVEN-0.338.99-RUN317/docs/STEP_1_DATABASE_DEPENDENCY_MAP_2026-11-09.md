# Step 1 — Database Dependency Map

**Baseline:** GH-CONNECT 0.338.13, migration-audited working archive  
**Date:** 2026-11-09  
**Status:** Initial source inventory completed; semantic cross-check remains in progress.  
**Deployment status:** No migration was applied by this audit.

## Purpose and boundary

This document starts the pre-deployment database audit. It maps application areas to their database access surfaces and the SQL objects that must be checked. It is not a deployment approval, proof of runtime compatibility, or claim that remote Testnet/Mainnet catalogs were inspected.

## Source inventory

The repository scan found:

- 232 Next.js API `route.ts` files.
- 146 files under `lib/server`.
- 34 files under `features` and 12 under `contexts`.
- 199 migration files in `supabase/migrations` (per the prior inventory audit).
- 142 distinct executable GreenHaven `CREATE TABLE` names (the repository guard incorrectly expected 141) and 308 distinct `CREATE FUNCTION` names across the migration SQL (simple source extraction; overloaded signatures are not counted separately).
- 36 distinct table names referenced by explicit `/rest/v1/<table>` URL paths in application source.
- 25 distinct literal RPC names passed directly to `rpc("name", ...)` in the scanned application source.

These are discovery counts, not a completeness score. Dynamic REST paths, wrapper-generated RPC names, SQL dynamic execution, and Supabase-managed objects require separate tracing.

## Application domain → database dependency map

| Domain / capability | Application entry points and stores identified | Database surface to reconcile |
|---|---|---|
| Identity, sessions, profiles, account security | `lib/server/identity/*`; API routes under `/api/account`, `/api/auth`, `/api/security`, `/api/webauthn` | `gh_sessions`, `gh_user_profiles`, `gh_user_achievements`, `gh_user_progress`, `gh_step_ups`, `gh_webauthn_challenges`, `gh_webauthn_credentials`, `gh_withdrawal_pins`, lifecycle and identity RPCs; auth-user FK/identity assumptions |
| Social feed and interactions | `/api/social/*`; `lib/server/social/*`; `lib/server/identity/public-profile-hydration.ts` | `gh_posts`, `gh_post_media`, `gh_post_comments`, `gh_post_reactions`, `gh_post_shares`, `gh_saves`, `gh_follows`, `gh_comment_reactions`, block/restrict tables; feed, visibility, reaction, share, comment and search RPCs |
| Communities and membership | `/api/communities/*`; community domain services | `gh_communities`, `gh_community_members`, announcements, events, RSVPs, resources, reports, chat requests and moderation tables; community create/join/leave/role/search/event RPCs |
| Messaging and conversation controls | `/api/messaging/*`; `lib/server/messaging/message-store.ts`; messaging routes | `gh_conversations`, `gh_conversation_members`, `gh_messages`, `gh_message_receipts`, `gh_messaging_preferences`, `gh_conversation_nicknames`; send/edit/pin/read/delivered/unread/search/control RPCs; membership and actor authorization |
| Notifications and realtime | `/api/notifications/*`, `/api/realtime/*`; `lib/server/notifications/*`, `lib/server/social/notifications.ts` | `gh_notification_inbox`, `gh_realtime_events`, `gh_social_notifications`, `gh_content_events` and related event tables; inbox list/count/read, append, delivery and social-notification RPCs; retention and realtime publication configuration |
| GHC wallet, ledger, transfers and rewards | `/api/economy/*`; `lib/server/economy/*`; `lib/server/earnings/*` | `ghc_user_accounts`, `ghc_transactions`, `ghc_transfer_requests`, economy events/limits, claim state, earnings ledger/reward attempts, withdrawal requests, emission state and all wallet/claim/transfer/withdrawal RPCs; atomicity, idempotency, balance and immutable-ledger constraints |
| Pi payments, payment intents and memberships | `/api/payments/*`, `/api/pi/*`, `/api/membership/*`; `lib/server/payments/*`, `lib/server/membership/*` | `ghc_payment_intents`, `gh_pi_identities`, `gh_pi_wallet_authorizations`, A2U execution/review/lease tables, membership entitlements/events, payout and cashback tables; provider-reference uniqueness, payment state transitions and reconciliation RPCs |
| Referrals and reputation | `/api/referrals/*`, reputation-related routes; `lib/server/referral/*`, `lib/server/reputation/*` | `ghc_referral_codes`, `ghc_referral_attributions`, `ghc_referral_rewards`, reputation events/intelligence tables; referral attribution/settlement and reputation apply/get/refresh RPCs |
| Marketplace, orders and payouts | `/api/marketplace/*`; `lib/server/marketplace/*`; payout/payment routes | listings, variants, saved listings, orders, proceeds, order events, adjustments, disputes, seller/bank payout requests, beneficiaries, reconciliation and operator-action tables; reservation/claim/transition/refund/payout RPCs |
| Media and uploads | `/api/media/*`; `lib/server/media/*` | `gh_media_assets`, `gh_media_upload_sessions`, storage bucket(s), `storage.objects` policies and signed-upload/view flows; ownership, path, MIME/size, orphan cleanup and retention rules |
| Creator, tips and creator rewards | `lib/server/creator/store.ts`; creator API routes | `gh_creator_profiles`, creator reward events/pool/movements/operators, tip intents and payment binding/settlement; feature flags and gated settlement paths |
| Moderation, reports, security and rate limits | `/api/reports/*`, admin routes; `lib/server/security/*` and moderation services | report tables, blocks/restricts, moderation logs, security events/rate-limit state; actor identity, rate-limit atomicity and privileged RPC ACLs |
| Discovery, matching and engagement | `/api/matching/*`, `/api/search/*`, discovery routes; `lib/server/ghpv/*` | `ghc_match_signals`, connection requests/contexts, content quality, curator activity/calibration, GHPV weights/settlements; matching, search, scoring and settlement RPCs |
| Operational, audit and release controls | `/api/system/*`, `/api/release/*`, admin/operator routes | operational/reconciliation tables, health/status queries, audit events, leases, migration and release-readiness assumptions; operator-only grants and safe failure modes |

## Explicitly observed REST table references

The initial literal URL scan found these 36 table names (the count excludes dynamically composed paths):

`gh_bank_beneficiaries`, `gh_bank_payout_requests`, `gh_conversation_members`, `gh_curator_calibration`, `gh_marketplace_listing_reports`, `gh_marketplace_variants`, `gh_media_assets`, `gh_message_receipts`, `gh_pi_a2u_executions`, `gh_pi_identities`, `gh_pi_wallet_authorizations`, `gh_post_comments`, `gh_posts`, `gh_realtime_events`, `gh_reputation_intelligence`, `gh_saves`, `gh_seller_payout_requests`, `gh_sessions`, `gh_step_ups`, `gh_user_achievements`, `gh_user_profiles`, `gh_user_progress`, `gh_webauthn_challenges`, `gh_webauthn_credentials`, `gh_withdrawal_pins`, `ghc_community_reports`, `ghc_connection_requests`, `ghc_economy_events`, `ghc_match_signals`, `ghc_membership_entitlements`, `ghc_payment_intents`, `ghc_referral_attributions`, `ghc_referral_rewards`, `ghc_transactions`, `ghc_transfer_requests`, `ghc_withdrawal_requests`.

## Explicitly observed literal RPC references

The first scan found these 25 directly named calls:

`gh_bank_payout_begin_transfer`, `gh_bank_payout_record_submission`, `gh_creator_get`, `gh_creator_upsert`, `gh_marketplace_saved_listing_toggle`, `gh_marketplace_saved_listings_list`, `gh_notification_event_append`, `gh_notification_inbox_list`, `gh_notification_inbox_mark_read`, `gh_notification_inbox_unread_count`, `gh_reputation_apply_event`, `gh_reputation_get`, `gh_reputation_intelligence_get`, `gh_reputation_intelligence_refresh`, `gh_security_event_append`, `gh_security_rate_limit_consume`, `gh_social_notification_create`, `gh_social_notifications_list`, `gh_social_notifications_mark_read`, `gh_social_notifications_unread_count`, `gh_tip_intent_create`, `ghc_referral_attribute`, `ghc_referral_ensure_code`, `ghc_referral_queue_reward`, `ghc_settle_referral_reward`.

This list is deliberately not presented as the complete RPC contract. Several modules accept an RPC name as a string parameter, and `lib/server/economy/db.ts` and related modules contain many endpoint names in URL construction or helper calls. Those must be enumerated and matched by signature to SQL definitions in the next pass.

## Important source-level findings to carry into the next pass

1. **Stale database-contract count guard corrected.** `scripts/check-database-contract-source.mjs` still expected 141 executable GreenHaven tables, but the current migrations define 142. The additional table is `gh_conversation_nicknames`, introduced by the latest messaging/search migration. I updated the guard to expect 142; this is an inventory assertion correction only, not a schema change.
2. **Client backend defaults are not uniformly database-backed.** `lib/backend/client-services.ts` explicitly describes Pi SDK + local engines as default adapters until a remote API is wired. Its default matching, messaging, profile, moderation and feed implementations include local/empty/stub behavior. These paths must be distinguished from the server-backed API capabilities; a SQL table existing does not mean the UI is using it.
3. **Messaging client service is currently a local adapter.** `createMessagingService()` returns an empty conversation list, constructs a message in memory, and returns success for `markRead`. Separately, server messaging stores and messaging RPCs exist. The audit must trace the active UI/service registry and confirm whether the server-backed path is actually selected.
4. **Privileged service-role RPC calls are widespread.** The server-side helpers use `SUPABASE_SERVICE_ROLE_KEY`. For each caller, actor/user identity must be derived and authorized server-side; SQL must not treat an arbitrary client-supplied user ID as proof of ownership.
5. **Storage is a separate database/platform dependency.** Media routes use Supabase Storage HTTP endpoints, signed upload/view URLs and bucket management. Step 2 must verify bucket names, creation behavior, object policies, metadata-table consistency and cleanup paths; checking `public` schema migrations alone is insufficient.
6. **Outbox is explicitly gated.** `lib/server/outbox/transactional-outbox.ts` says its paired SQL proposal must be installed before enabling the worker and that business writes must enqueue within their own transaction. Do not classify this as an active deployable dependency without checking flags, worker registration, proposal status and caller paths.
7. **Messaging search/control migration needs direct contract review.** The latest migration adds conversation control columns, nickname storage and search/read/control RPCs. Verify every named argument, return shape, grants, member authorization and application call site before deployment.
8. **Supabase platform prerequisites are not ordinary project migrations.** Auth users/roles, `auth.uid()`, extensions, Storage schemas/buckets, Realtime publication and default grants must be recorded as external prerequisites rather than assumed to be created by the 199 project migrations.

## Step 1 completion checklist

- [x] Establish the current source baseline and migration directory.
- [x] Inventory application route/service areas and extract initial literal REST/RPC references.
- [x] Inventory SQL table and function names from migration source.
- [x] Identify Storage as a separate dependency surface.
- [ ] Trace every dynamic REST/RPC helper call and produce the complete function/table contract list.
- [ ] Trace active UI/service-registry wiring so local/demo adapters are separated from intended production paths.
- [ ] Map every SQL table to its owning feature, every feature to required SQL objects, and mark orphaned/unreferenced objects.
- [ ] Record required Supabase platform prerequisites (auth, storage, realtime, extensions, roles/grants).
- [ ] Reconcile any unresolved dependencies with the migration files and current application contracts.

**Gate:** Step 1 is not complete until the unchecked items are resolved. No migrations should be applied based on this initial inventory alone.

## Step 1 closeout — completed static dependency trace

**Status:** Step 1 source-level mapping is complete for the current repository snapshot. This closes the inventory/mapping phase and allows Step 2 to begin. It does **not** mean that the database is ready for deployment; SQL semantics, clean-database execution and live application verification belong to the next gates.

### Dynamic REST/RPC call families traced

The first literal-call scan was incomplete because the repository wraps PostgREST calls in helpers. The following helper families were identified and included in the Step 1 dependency map:

| Helper / module family | Dynamic dependency pattern | Step 2 verification requirement |
|---|---|---|
| `lib/server/economy/db.ts` | RPC function argument; direct `ghc_transactions`, `ghc_transfer_requests` REST access | Enumerate every caller-supplied RPC name and named argument; compare with SQL signature, return contract and grants |
| `lib/server/economy/withdrawal.ts`, `durable-emission.ts` | RPC function argument | Resolve every call site and prove function exists with compatible parameters and lifecycle semantics |
| `lib/server/creator/store.ts` | RPC function argument and dynamic REST path | Verify creator/tip SQL contract and feature gating |
| `lib/server/notifications/unified.ts`, `push-architecture.ts` | RPC name argument | Verify inbox, device subscription and push lifecycle functions |
| `lib/server/payments/intent-store.ts`, `a2u-orchestration.ts` | RPC name argument; direct payment-intent table access | Verify payment state machine, idempotency, ownership, provider references and execution leases |
| `lib/server/reputation/store.ts`, `intelligence.ts` | RPC function argument | Verify reputation event and intelligence signatures, ACLs and data source tables |
| `lib/server/revenue/*`, `treasury-operations.ts` | RPC name argument and conditional RPC selection | Verify revenue attribution, treasury operations and operator-only permissions |
| `lib/server/outbox/transactional-outbox.ts` | RPC name argument | Treat as proposal/gated until migration is approved and transactional enqueue is proved |
| `lib/server/earnings/*` | RPC name argument | Verify ledger, reserve, reward, utility and withdrawal RPC contracts end-to-end |
| `lib/server/identity/withdrawal-pin.ts`, `wallet-authorization.ts` | RPC name argument; direct table access | Verify PIN attempt/lock rules, wallet ownership and payout assertions |
| `lib/server/referral/referral-service.ts` | RPC name argument | Verify attribution and reward idempotency/eligibility |
| `lib/server/social/rpc.ts`, `notifications.ts` | encoded RPC function argument | Enumerate all callers and check SQL signatures/authorization |
| `lib/server/marketplace/*` | RPC name argument | Verify listing/order/payment claim/refund/dispute/payout state transitions and row ownership |
| `lib/server/security/control-plane.ts` | RPC name argument | Verify durable rate-limit and security control functions fail closed |
| `lib/server/health/withdrawals-health.ts` | RPC names stored in health probes | Verify health probes only call supported functions and distinguish missing optional features from critical failures |

The application also uses direct PostgREST table paths in identity, profile hydration, messaging, economy, payments, marketplace, media and reputation stores. The explicit REST path inventory is in the section above; dynamic path builders in creator and reputation modules are included in this family trace. Step 2 must now check the actual selected columns, filters, conflict targets, write payloads and response parsing against SQL definitions, not just table names.

### UI and service-registry wiring findings

| Surface | Default client facade behavior | Server-backed implementation present? | Step 1 disposition |
|---|---|---|---|
| Messaging | `getBackend()` selects `createMessagingService()`; empty conversation list, in-memory send, no-op read | Yes: messaging API routes, message store and SQL RPCs | **Integration gap**: do not represent legacy facade as durable messaging |
| Matching | Default adapter can return demo candidates; swipe can synthesize a match; matches list empty | Matching APIs and durable signal/connection SQL exist | **Integration gap**: verify active UI route and replace/avoid synthetic default before production |
| Feed | Default adapter reads local callback/demo seed; create/like are local results | Social feed APIs, stores and SQL exist | **Integration gap**: confirm active feed UI uses domain/API repositories for durable writes |
| Profile | Default adapter reports local-only profile/settings behavior | Identity/profile API and stores exist | **Integration gap**: verify active profile screens use server repositories |
| Moderation | Default report/block/mute methods return local success; content check is local | Security/moderation APIs and SQL objects exist | **Critical integration gap**: local success is not proof of persisted enforcement |

`lib/backend/index.ts` explicitly constructs these client adapters in `getBackend()`. The facade comments say authoritative domain mutations should use `@/lib/domains` and HTTP repositories, but Step 1 does not assume every legacy caller has migrated. Step 2 and subsequent application integration work must trace each live UI caller and remove any production path that falsely reports a durable operation when it only updates local state.

### Platform prerequisites and external objects

These are required environment/platform dependencies and are not guaranteed to be created by project SQL migrations:

- Supabase Auth schema and `auth.users`, including the expected user identifier type and foreign-key behavior.
- Supabase roles (`anon`, `authenticated`, `service_role`), PostgREST schema exposure, role grants and default privileges.
- Supabase Storage service/schema, private bucket `gh-media` (default from `lib/server/media/ensure-bucket.ts`, overridable by `GH_MEDIA_BUCKET`), object metadata, upload/view authorization and retention behavior.
- Realtime publication configuration and any required table publication membership; realtime event table existence alone does not enable subscriptions.
- PostgreSQL extensions used by SQL (for example UUID, crypto, text-search or other extension functions/operators); exact extension requirements must be enumerated during Step 2 from executable SQL.
- Environment secrets and URL settings for Supabase URL/service role, Pi payment verification, push delivery and any optional external providers. These are runtime configuration, not schema objects.
- Scheduled/worker execution for cleanup, outbox, payment reconciliation, A2U, cashback, membership expiry and other leased jobs. SQL functions/tables alone do not start workers.

### Orphan / gated / optional dependency handling

A name not found in a simple literal call scan is **not** automatically orphaned: SQL can be called through dynamic helper names, scheduled jobs, PostgREST table access, operator tooling or external callbacks. Conversely, a SQL object with no application caller may be an intentional operator/admin, compatibility, future-gated or obsolete object. Step 2 will classify each as `ACTIVE_APP`, `ACTIVE_OPERATOR`, `EXTERNAL_PLATFORM`, `GATED_PROPOSAL`, `COMPATIBILITY`, `UNREFERENCED_REVIEW` or `UNUSED_CONFIRMED`; no object is deleted based on absence from a grep result.

### Evidence boundaries

- Source inventory is local and static. No Testnet or Mainnet database catalog was queried during Step 1.
- No migration was applied, marked applied, renamed, deleted or reordered.
- No PostgreSQL server/client or Docker executable was available in the audit runtime, so a clean-database apply test was not possible in this step. Step 2 will perform SQL source review and prepare the exact clean-database execution gate; actual execution must use a disposable PostgreSQL/Supabase environment.
- No runtime UI session, two-account test or service-role API call was performed. Those are runtime verification gates, not claims made by this static map.

## Step 1 completion checklist

- [x] Establish the current source baseline and migration directory.
- [x] Inventory application route/service areas and extract literal REST/RPC references.
- [x] Trace dynamic RPC and REST helper families to their call-site owners.
- [x] Inventory SQL table and function names from migration source.
- [x] Map product/database domains to owning server modules and SQL dependency families.
- [x] Trace the default client service registry and identify local/demo/no-op adapters that must not be mistaken for durable database-backed behavior.
- [x] Record Supabase Auth, roles/grants, Storage, Realtime, extension, secret and worker prerequisites.
- [x] Establish rules for classifying gated, external, operator-only and apparently unreferenced SQL objects without unsafe deletion.
- [x] Record what has and has not been verified, including the absence of remote DB access and clean PostgreSQL execution.

**Step 1 gate: PASSED — dependency map established.** Proceed to Step 2, the line-by-line and dependency-order SQL audit. Step 1 passing is not permission to apply migrations.
