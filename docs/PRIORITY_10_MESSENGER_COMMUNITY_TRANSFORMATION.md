# Priority 10 — Messenger and Community Communications Transformation

Release: `0.338.12` (Phase 1 started)
Baseline: `0.338.10` (derived from the authoritative `0.338.9` project archive)
Reference: user-supplied Facebook Messenger screen recording (`489405.mp4`, approximately 77 seconds)

## Reference review

The recording demonstrates:
- A one-to-one conversation with incoming/outgoing bubbles, timestamps, message reactions, and a message composer.
- Attachment entry points and a conversation-level shared-media gallery containing image and video items.
- An emoji/reaction picker.
- Voice-message playback with a visible waveform and duration.
- Audio and video call entry points, outgoing/ringing/connecting/ended call states, and call controls.
- Video-call camera preview, touch-up and colour-filter controls.
- A conversation details surface with call, video, profile, mute, mark-unread, share-contact, create-group, quick-reaction, nickname, read-receipt, block and report actions.

The recording is treated as a product reference, not as evidence that GreenHaven should copy Facebook's exact visuals, labels, data model, or privacy defaults.

## Existing GreenHaven capabilities found in source

The current codebase already includes:
- Direct, group and community conversation classification and inbox filters.
- Conversation pin, archive and mute actions.
- Session-derived identity and conversation membership checks on durable messaging routes.
- Message send, reply, forwarding, reaction, delete-for-me and delete-for-everyone paths.
- Message status fields for sending, sent, delivered, read and failed.
- Presence heartbeats and typing-state updates with server expiry.
- Durable media upload policies for images, video, audio and documents.
- Offline draft/queue handling and bounded message windows.
- Community membership, invitations, moderation/governance and community chat routes.

## Gaps and important truth boundaries

- The current thread search is limited to messages loaded in the active conversation. The exposed `searchMessages` helper is also local to the in-memory message list; there is no evidence here of a full-history indexed search endpoint.
- `sendVoiceNote` is explicitly device-local and is disabled when durable messaging is enabled. The current durable messaging API is text-first; do not claim cross-device voice delivery until a durable, membership-checked audio-message contract is implemented and verified.
- The header currently does not wire its optional call/video callbacks. No call signaling, invitation, TURN configuration, call persistence, ringing, or call recovery service was found in the inspected UI path. Call buttons must not be represented as operational until that full stack exists.
- Blocking, reporting, read-receipt preferences, contact sharing and nicknames require end-to-end checks across UI, API, database policy and privacy semantics before they can be declared complete.
- The new shared-media view only aggregates attachments in the currently loaded message window. It is not a complete server-side media archive.

## Implemented in 0.338.11

1. Added a shared-media entry point to the active conversation header.
2. Added a responsive shared-media panel for loaded image, GIF, video, voice and file attachments.
3. Added native video playback controls in the shared-media panel.
4. Added native audio playback controls for voice attachments in message bubbles.
5. Added audio playback controls for voice attachments in the shared-media panel.
6. Added explicit item count and a no-media empty state.
7. Added an honest scope note that the gallery reflects loaded history only.
8. Added Escape-to-close for the shared-media panel.
9. Preserved existing upload, message authorization, conversation membership and durable delivery boundaries.
10. No SQL migration, privileged RPC, payment behavior or authorization relaxation was introduced.

## Upgrade programme — 35 workstreams

Status meanings: **Existing** = source support already found; **Improved** = implemented in this release; **Needs backend** = requires additional API/database/provider work; **Needs verification** = source exists but runtime/authorization behavior must be proven.

### Messaging and inbox
1. Unified inbox sections and filters — Existing.
2. Pinned, archived and muted conversations — Existing; verify cross-device persistence.
3. Online status and last-seen — Existing; verify lease expiry and privacy settings.
4. Typing indicators — Existing; verify multi-device behavior and rate limits.
5. Message delivery/read states — Existing; verify recipient semantics and group receipts.
6. Reply and quoted-message context — Existing; verify deletion and pagination behavior.
7. Reactions — Existing; verify durable toggle/idempotency.
8. Forwarding — Existing UI path; verify original-content access and abuse controls.
9. Delete-for-me / delete-for-everyone — Existing; verify server enforcement and time window.
10. In-thread search — Existing, loaded-window scope only.
11. Full-history indexed search — Needs backend.
12. Message editing with history and edit window — Needs backend verification/implementation.
13. Pinned messages inside threads — Needs backend verification/implementation.
14. Mark unread and unread boundary management — Needs backend verification/implementation.
15. Message requests, accept/decline and anti-spam — Existing foundations; needs full runtime verification.

### Media and voice
16. Durable image, video and document attachments — Existing; verify upload limits and cross-device access.
17. Shared-media gallery — Improved in 0.338.11; currently loaded-window only.
18. Voice message playback — Improved in 0.338.11 for existing voice attachments.
19. Durable voice recording and sending — Needs a new durable audio-message contract; current implementation is device-local.
20. Attachment preview, download and failure recovery — Existing foundations; verify file-type and content-disposition safety.
21. Media retention, deletion and access revocation — Needs backend/privacy audit.

### Calls and presence
22. One-to-one audio calling — Needs backend/provider.
23. One-to-one video calling — Needs backend/provider.
24. Incoming call invitations and accept/decline — Needs backend/provider.
25. Call history, missed calls and reconnect — Needs backend/provider.
26. TURN relay, ICE configuration and network diagnostics — Needs managed infrastructure and secrets.
27. Camera/microphone permission, device switching and privacy controls — Needs implementation after signaling.
28. Video effects/background filters — Needs device capability and performance assessment; not a prerequisite for reliable calls.

### Conversation controls and safety
29. Conversation details and participant roster — Needs cohesive UI/API wiring.
30. Profile/contact sharing and create-group-from-DM — Needs product/privacy contract.
31. Nicknames and per-conversation quick reaction — Needs durable preference contract.
32. Read-receipt preferences — Needs explicit privacy semantics and durable preference API.
33. Block/report/mute controls — Existing safety foundations vary by surface; needs complete end-to-end verification.
34. Abuse reporting, rate limits and attachment scanning — Needs integrated moderation/operations verification.
35. Community announcements, events, group calls, member directories, topic channels and shared files — Needs staged community product/API work.

## Recommended safe sequence

A. Complete UI-level conversation details, loaded media, voice playback and inbox controls without changing privileged behavior.
B. Design and review durable media-message storage and authorization before enabling voice recording for durable messaging.
C. Implement full-history search and pinned/edit/mark-unread actions only after defining indexed query bounds, ownership rules, retention and idempotency.
D. Build calls as a separate secured subsystem: authenticated invitation, membership/relationship authorization, private signaling, short-lived call state, TURN credentials, rate limits, abuse reporting, missed-call history, cleanup and device tests. WebRTC alone does not provide signaling or TURN infrastructure.
E. Extend Community with announcements, topics, event RSVPs, member roles, media/files and moderation using its existing governance and membership boundaries.
F. Run two-account and multi-device browser/mobile tests, including offline recovery, permission denial, upload interruption, blocked-user behavior and membership revocation.

## Verification status

Source-level checks are not runtime proof. The shared-media and voice-player changes have focused static regression assertions. Full Node 24.15.0 dependency-backed typecheck, lint and production build, browser/device tests, live Supabase RLS/migration verification, two-account tests, and real audio/video provider tests remain required before production approval.

## Research references

- Supabase Realtime Broadcast: https://supabase.com/docs/guides/realtime/broadcast
- Supabase Realtime Presence: https://supabase.com/docs/guides/realtime/presence
- MDN WebRTC signaling and video calling: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling
- MDN getUserMedia security and permissions: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN ICE/STUN/TURN connectivity: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols

Design implication: Supabase Broadcast can carry authenticated signaling messages, but private-channel subscription authorization is not the same as row-level access to persisted messages. Presence should remain low-frequency; high-frequency call signaling belongs in Broadcast. WebRTC requires explicit offer/answer and ICE-candidate exchange, and reliable cross-network calling requires TURN infrastructure, not only a STUN URL.


## Four-phase execution update

The 35 workstreams are now mapped into four execution phases in `docs/PRIORITY_10_FOUR_PHASE_EXECUTION_PLAN.md`, which also contains the consolidated source capability audit, research references, security gates and implementation ledger. Phase 1 has started in 0.338.12 with an accessible conversation information centre. The rest of Phase 1 remains open; no claim is made that message editing/pinning, server-side full-history search, durable settings, contact sharing or group creation are complete.
