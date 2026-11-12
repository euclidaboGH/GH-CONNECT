# Priority 10 — Four-phase execution plan

Release target: `0.338.x` communications transformation  
Working baseline: `0.338.13` (derived from the user's authoritative `0.338.9` archive)  
Reference: user-supplied Messenger screen recording `489405.mp4` (about 77 seconds)

## Product review and research record

The reference recording was reviewed for functional patterns, not copied as a branded visual template. It demonstrates direct/group conversation, message actions and reactions, shared media, emoji entry, voice playback, audio/video call states, camera preview/effects, and conversation-level controls including profile, mute, unread, contact sharing, group creation, nickname, read receipts, block and report.

Research sources reviewed:

- Supabase Realtime Broadcast: https://supabase.com/docs/guides/realtime/broadcast — low-latency signaling/event transport; private-channel subscription is not a substitute for row-level data authorization.
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization — channel access should be enforced by `realtime.messages` RLS policies; private channels must be configured consistently.
- Supabase Presence: https://supabase.com/docs/guides/realtime/presence — use for slow-changing online state, not high-frequency event streams.
- Supabase Postgres Full Text Search: https://supabase.com/docs/guides/database/full-text-search — use indexed `tsvector`/query design for bounded full-history search.
- WebRTC peer connections: https://webrtc.org/getting-started/peer-connections — signaling and ICE configuration are required to establish peer connectivity.
- MDN WebRTC signaling and video calling: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling — signaling is an application service separate from the WebRTC API.
- MDN WebRTC protocols: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols — ICE uses STUN/TURN to handle NAT/firewall paths.

## Existing-capability audit (source inspection, not live certification)

| Area | Found in the source | Boundary / remaining proof |
|---|---|---|
| Inbox | Direct, group and community conversation classification; inbox filters | Verify pagination, cross-device ordering and unread boundaries in runtime |
| Conversation preferences | Personal pin/archive/mute API and membership check | Confirm DB RPC/schema and two-user isolation in Testnet |
| Messaging | Durable send/sync, reply, forwarding, reactions, delete-for-me/everyone | Verify idempotency, group semantics, deletion windows and abuse limits |
| Delivery | Sending/sent/delivered/read/failed states; presence and typing APIs | Validate recipient-level receipts and multi-device convergence |
| Search | GIN-indexed PostgreSQL full-history search and authenticated endpoint added in 0.338.13 | Migration is REVIEW_REQUIRED/unapplied; verify Testnet and two-account isolation before operational use |
| Media | Upload policies for image/video/audio/document; shared-media panel in 0.338.11 | Gallery currently covers loaded history; verify signed access, revocation and retention |
| Voice notes | Device-local recording path and playback for existing voice attachments | Durable voice sending is not implemented; needs durable attachment/message contract |
| Calls | Optional call callbacks in header only | No proven signaling, invitation, ICE/TURN, call persistence, ringing, push or recovery stack |
| Conversation settings | Durable actor-to-target nicknames, per-member quick reaction/read receipts and atomic personal pin/archive/mute contract added in 0.338.13 | Migration is REVIEW_REQUIRED/unapplied; UI settings controls and two-account persistence acceptance remain |
| Message controls | Sender-only edit and member-authorized pin/unpin RPC/API contracts exist; edit timestamp and pin flag are durable | Edit-history audit trail and pinned-message listing UX remain to verify/complete |
| Contact/group | Existing profile/relationship data and group/community foundations | Contact share consent and create-group-from-DM flow need privacy + membership tests |
| Community | Membership, invitations, governance/moderation, community chat, events/posts data types | Announcements/topics/event lifecycle, member directory and shared resource surfaces need end-to-end implementation |

## Four-phase roadmap (35 workstreams)

### Phase 1 — Conversation foundation, controls and safe settings (workstreams 1–15)

1. Inbox sections and filters — existing; audit convergence.
2. Personal pinned/archived/muted conversations — existing; verify durable isolation.
3. Online status and last-seen — existing; validate lease expiry and audience privacy.
4. Typing indicators — existing; validate rate limits and multi-device behavior.
5. Delivery/read states — existing; validate recipient semantics and preference behavior.
6. Reply and quoted-message context — existing; verify pagination/deletion.
7. Durable reactions — existing; verify toggle idempotency.
8. Forwarding — existing; verify source authorization and abuse controls.
9. Delete-for-me/everyone — existing; verify server-enforced scope/window.
10. Loaded-window search — superseded by server-side indexed full-history search in 0.338.13.
11. Full-history indexed search — source implementation added; migration held for review and two-account Testnet acceptance.
12. Message editing and edit history — sender-only durable edit contract exists; edit-history audit trail and time-window policy remain.
13. Pinned messages within a thread — durable member-authorized pin/unpin contract exists; pinned-message listing UX remains.
14. Mark unread and unread boundary — implement durable per-user cursor semantics.
15. Message requests/accept/decline — verify complete anti-spam flow.

Phase 1 increments (`0.338.12`–`0.338.13`): added the information centre, durable per-member controls, actor-to-target nicknames, read-receipt opt-out semantics, durable edit/pin contract validation and indexed server-side full-history search UI/API/RPC. The new migration remains REVIEW_REQUIRED and unapplied. Phase 1 is not cleared until Testnet migration and two-account verification pass, and contact sharing/group creation from conversations are completed end-to-end.

### Phase 2 — Durable media, voice and message archive (workstreams 16–21)

16. Durable image/video/document attachment hardening.
17. Shared-media archive with server pagination and membership checks.
18. Voice message playback across devices.
19. Voice recording, upload finalization and durable message delivery.
20. Attachment preview/download/failure recovery.
21. Retention, deletion, access revocation and media scanning.

### Phase 3 — Real-time audio/video calling (workstreams 22–28)

22. One-to-one audio calls.
23. One-to-one video calls.
24. Authenticated incoming invitations and accept/decline.
25. Durable call history, missed calls, reconnect and expiry.
26. TURN/ICE infrastructure, secret rotation and connectivity diagnostics.
27. Permission/device selection, mute/camera controls and privacy affordances.
28. Optional video effects only after baseline call reliability and device capability gates.

### Phase 4 — Community communications and governance (workstreams 29–35)

29. Conversation information centre and participant roster — Phase 1 UI foundation, extend with verified roster authority.
30. Contact sharing and create-group-from-DM with explicit consent and membership validation.
31. Durable per-conversation nicknames and quick-reaction defaults — source contracts added in 0.338.13; Testnet verification pending.
32. Read-receipt preferences with explicit sender/recipient privacy semantics — source contract and opt-out semantics added in 0.338.13; Testnet verification pending.
33. End-to-end block/report/mute safety controls and operator visibility.
34. Abuse reporting, rate limits, attachment scanning and moderation workflows.
35. Community announcements, topic channels, events, member management/directories, shared resources and moderation improvements.

## Implementation and verification ledger

| Release | Delivered | Evidence | Not yet proven |
|---|---|---|---|
| 0.338.11 | Shared-media loaded-history panel, image/GIF/video/file presentation, native audio/video playback, voice playback; preserved composer/search/community resilience | 205 focused assertions passed in the preceding increment | Full-history archive, durable voice sending, calls, production build/typecheck/lint, live DB and device tests |
| 0.338.12 | Phase 1 conversation information-centre foundation; Escape dismissal; accessible dialog; explicit scope and privacy boundary; four-phase roadmap and source audit | `check:priority10-phase1` 15/15 | Durable settings, indexed search and two-account acceptance |
| 0.338.13 | Actor-to-target nicknames; quick-reaction and read-receipt preferences; read-receipt opt-out; atomic per-member controls; server GIN full-history search API/RPC/UI; existing edit/pin contracts retained; migration held for review | Phase 1 closeout 16/16; search UI 10/10; messaging bounded JSON 28/28; SQL lexical integrity; 199-migration manifest | Migration unapplied; Testnet/Mainnet history reconciliation, PostgreSQL execution, two-account authorization, contact sharing/group creation, Node 24 build and browser/device acceptance |

## Security and release gates

- Never accept a client-supplied actor ID as authority; derive identity from the authenticated session.
- Every conversation read/write must re-check membership and, where relevant, block/request state.
- Use bounded request bodies, query limits, cursor pagination, idempotency keys and rate limits.
- Search must use a server-side index and filter by authorized conversation membership before returning snippets or counts.
- Audio must upload to an authorized private storage path, finalize server-side, then create a durable message referencing that asset; clients must not be able to forge another user's asset ownership.
- Calls must use private signaling topics with membership/relationship RLS, short-lived call records, authenticated invite/accept/decline, ICE candidate validation, TURN credentials from server secrets, expiry and abuse limits. Broadcast private-channel access alone does not authorize arbitrary database reads.
- No feature is production-certified until Node 24.15 typecheck/lint/build, focused regression tests, migration validation, Testnet RLS/two-account tests, Pi Browser/device checks and operational monitoring pass.

## Phase 1 completion status

**Source implementation substantially complete, external closeout blocked.** 0.338.13 adds durable scoped settings, read-receipt preference enforcement, indexed full-history search and retains the existing edit/pin contracts. Migration `20261109100001_gh_messaging_phase1_controls_search.sql` is REVIEW_REQUIRED and unapplied. Do not advance to Phase 2 until Testnet/Mainnet histories are reconciled, the migration is explicitly approved and tested, two-account positive/negative membership checks pass, and contact sharing/group creation from conversations are accepted end-to-end. No live DB verification or production certification is claimed.
