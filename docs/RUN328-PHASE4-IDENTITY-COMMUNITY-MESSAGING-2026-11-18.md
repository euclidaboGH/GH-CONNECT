# RUN328 — Phase 4 Identity, Community and Messenger implementation

**Source:** RUN327 local working derivative, itself derived from RUN326 and the user-designated RUN324 archive chain.  
**Package:** `gh-connect@0.338.99`  
**Status:** Phase 4 source implementation started across all three user-selected tracks. Not operationally complete; not deployed; production NOT APPROVED.

## User-selected Phase 4 scope

The user selected all three offered tracks, so RUN328 coordinates them as one Phase 4 programme:

1. Identity & Authentication.
2. Community posts/discussion consistency and community participation.
3. Messenger community communications, group invitations and consent-based contact sharing.

This is additive to existing Phase 3 Feed, Community, Messaging and Marketplace work. It does not replace the earlier financial/cart/profile Phase 4 records; those remain separate historical roadmap entries.

## 1. Identity and authentication

- Corrected `/api/auth/step-up` ordering: a GH session token is rotated before a step-up proof is created, and the proof is bound to the rotated session ID.
- If durable step-up proof storage fails after token rotation, the failure response still returns the new session cookie, but does not grant elevated privileges. This avoids both stale-token elevation and accidental session lockout.
- Public profile hydration now explicitly requests `no-store` through the central privileged REST client.
- Added an atomic session-ceiling RPC proposal. It uses a per-user transaction advisory lock, revokes the oldest active sessions and inserts the new session in one transaction. It is service-role only.
- Atomic session issuance is deliberately opt-in through `GHC_ATOMIC_SESSION_CAP_RPC_ENABLED=1`. The default runtime path remains the existing durable REST session insert/cap flow until the proposal has been rehearsed and applied. Do not set the flag before that gate.

## 2. Community discussion and participation

- Existing canonical read-only post rendering remains shared across Feed/Profile/Community. Existing Community source gates confirm archived, preview and legacy board posts use the canonical renderer and suppress write/reward panels in read-only mode.
- Existing durable Community platform surfaces already include announcements, events, RSVP, resources and moderator report resolution. RUN328 retains these server-owned surfaces and adds a paginated member-directory contract.
- Added authenticated, session-only `GET /api/communities/[id]/members` with bounded limit/offset, durable fail-closed rate limiting and private no-store responses.
- Added `gh_community_member_directory` to the held SQL proposal. It checks public/private community access and selects only public identity fields. A member whose profile visibility is hidden/matches-only is represented as `Private member` with no username/photo; private profile fields are never selected for output.
- The hub now loads this canonical directory in pages of 50 and can load more. Until the proposal is applied, the UI shows only the available self/membership snapshot; it no longer fabricates member names from opaque IDs.

## 3. Messenger community communications

- Added session-only, rate-limited `POST /api/messaging/conversations/group` to create a group from an existing direct conversation.
- Group creation validates the authenticated actor's source-DM membership, the single peer in that DM, invitee identity existence and reciprocal block state. The creator is the only initial group member; the DM peer and selected additional participants receive pending invitations and do not gain membership until they accept. Group creation uses a stable client request ID, a per-request advisory lock, exact-payload conflict detection and a unique request index, so retries return the original group rather than creating duplicates. Invite notifications are created through the existing canonical notification RPC.
- Added a private invitation inbox and accept/decline routes. Invitation response derives the actor from the active GH session and the database RPC verifies that actor is the exact invitee, checks expiry and rechecks blocks before membership is added. Matching repeated accept/decline requests are idempotent; the denormalized conversation member count is synchronized by a database trigger on membership insert/leave/removal.
- Added `POST /api/messaging/conversations/[conversationId]/contacts` to share only the authenticated actor's own public GreenHaven profile. It does not accept a target user ID and does not disclose phone, email or other private profile fields. The SQL proposal requires an onboarded profile with `profileVisibility=everyone`, active conversation membership and no reciprocal block with any conversation member.
- Shared profile identity now survives durable message hydration and renders as a profile card that opens the public profile.
- The new actions use session-only authorization and fail closed when their SQL functions are not installed. They do not fall back to local/in-memory group or contact records.

## Held SQL proposal — not a migration

`supabase/proposals/20261118_phase4_identity_group_contact.sql` contains:

- `gh_session_issue_with_cap` — atomic session ceiling + durable session insert.
- `gh_conversation_invites` — pending per-recipient group invitations with deny-all browser RLS and service-role table access.
- `gh_messaging_sync_member_count` — database-maintained active member count for group/conversation joins and leaves.
- `gh_messaging_group_create_from_dm` — owner-created group with pending invitations, exact-payload idempotency and no automatic membership for invitees.
- `gh_messaging_group_invite_respond` — invitee-only accept/decline and block recheck.
- `gh_messaging_share_own_contact` — idempotent public-profile share message.
- `gh_community_member_directory` — privacy-aware public member directory.

Declared dependencies include `gh_sessions`, `gh_conversations`, `gh_conversation_members`, `gh_messages` (including `client_message_id`, `shared_type`, `shared_id`, `meta`), `gh_pi_identities`, `gh_user_profiles`, `ghc_user_blocks`, `gh_social_notification_create` and `service_role`.

The proposal is not generated as a canonical migration and is not applied. The runtime atomic-session flag remains off by default. Group/contact/member-directory routes return unavailable rather than simulating database success until the proposal is approved, rehearsed and applied. Do not manually enable the session RPC flag early.

## Verification

- Coordinated Phase 4 source gate: 32/32.
- Phase 4 identity/authentication source gate: 16/16.
- Phase 4 identity integration: 17/17.
- Community social boundary checks: 9/9.
- Community completion/canonical rendering/moderation checks: 21/21.
- Community pagination: 12/12.
- Existing Messenger Community transformation checks: 14/14.
- Phase 3 messaging idempotency: 10/10.
- Phase 2 atomic tally source contract: 20/20.
- SQL lexical check scans migrations and proposals: 236 files, balanced strings/comments/dollar quotes/parentheses.
- Held-migration readiness source check now inspects the Phase 4 proposal ACL/dependency contract.
- `npm run verify:static` completed successfully after RUN328 source changes.

## Not verified / release blockers

- Local Node is `v22.16.0`; project requires Node `24.15.x`.
- `npm run prebuild:checks` stops at `check-jsx-duplicate-props.mjs` because `node_modules/typescript` is absent. No clean dependency install was performed.
- Typecheck, lint and Next production build were not run successfully on the required Node runtime.
- No local PostgreSQL, `psql`, Supabase CLI or disposable database was available for the new SQL proposal. Lexical checks are not PostgreSQL parsing or transaction rehearsal.
- No migration history reconciliation, Testnet mutation, Mainnet mutation, GitHub push, Vercel deployment, Pi Browser acceptance or multi-account device acceptance was performed.
- Group creation, invitation acceptance, profile sharing and member directory require two-account live Testnet acceptance after the SQL proposal is reviewed/applied.
- Community announcements/events/resources/moderation remain dependent on their existing deployed schema and RPCs; this run does not claim that every held migration is live.

## Safety boundary

No economy, wallet, reward, payment, payout, treasury, membership-entitlement or financial ledger authority was changed. No balances or transactions were fabricated. Official GreenHaven/Pi branding and authentication identity remain intact. Mainnet remains untouched. No production release approval is implied.

## Archive

Source-only archive: `GREENHAVEN-0.338.99-RUN328-PHASE4-IDENTITY-COMMUNITY-MESSAGING.zip`. The archive is integrity-tested; its SHA-256 is supplied in the handoff message.
