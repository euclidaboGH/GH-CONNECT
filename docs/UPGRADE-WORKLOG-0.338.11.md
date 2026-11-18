# Upgrade worklog — 0.338.11

Date: 2026-11-09  
Baseline: 0.338.10  
Focus: Facebook Messenger reference review; shared media and voice playback; communications architecture audit.

## Delivered

- Reviewed the 77-second Facebook Messenger reference recording.
- Added a shared-media action to the conversation header.
- Added a responsive gallery for image, GIF, video, voice and document attachments in the loaded message window.
- Added native video playback controls in the gallery.
- Added native audio playback for existing voice attachments in message bubbles and the gallery.
- Added a labelled item count, empty state, loaded-history scope disclosure and Escape dismissal.
- Added a 35-workstream Messenger and Community transformation programme.
- Documented existing capabilities, backend gaps and safety gates for voice notes, calls, conversation preferences and community communication.
- Added 14 focused static assertions and wired the new gate into prebuild and static verification.
- No SQL migrations, privileged RPCs, financial changes or authorization relaxations.

## Reference findings

The video includes chat bubbles, read/seen states, media gallery, emoji picker, voice playback waveform, audio/video calling screens, call controls and video effects, profile access, mute, mark unread, contact sharing, create group, quick reaction, nicknames, read receipts, block and report.

## Validation

- Priority 10 Messenger/Community: 14/14.
- Priority 9 composer: 8/8.
- Priority 9 message search: 10/10.
- Priority 9 community action resilience: 9/9.
- Phase 6 messaging inbox: 8/8.
- Priority 8 messaging regression: 49/49.
- Repository consistency: 6/6.
- Documentation hygiene: PASS.
- UI/navigation/responsive audit: 31/31.
- Independent marketplace/community audit: 42/42.
- Bounded messaging JSON/security: 28/28.

**Total focused assertions:** 205 passed across the listed regression suites; documentation hygiene also passed. The Priority 8 check initially caught release identity drift after the package version increment; package-lock and in-app release identity were updated to 0.338.11, and the consistency gate then passed.

Node 24.15.0 dependency-backed typecheck, lint and production build, browser/device runtime, live Supabase RLS and two-account tests remain outstanding. Durable voice notes remain device-local only while durable messaging is text-first. Calling remains unimplemented until secured signaling and TURN infrastructure are configured and verified.
