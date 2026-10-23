# GREENHAVEN 0.70.3 — PHASE 32 REPORT
## Notification + Realtime Event Platform

Date: 2026-10-23
Base: Phase 31 Messaging Platform V2
Status: SOURCE-INTEGRATED / STATIC-VERIFIED

### Objective
Converge GreenHaven's fragmented social/economy/system notification stores into a durable notification projection and add a recoverable, user-scoped realtime event journal. Realtime remains a synchronization mechanism only; financial/payment outcomes remain server-authoritative through existing APIs.

### Major implementation
1. Added `gh_notification_inbox` as the unified per-user notification projection.
2. Added `gh_realtime_events` as a durable user-scoped synchronization journal with monotonic identity sequence.
3. Added idempotent notification creation, cursor pagination, unread count and authenticated read RPCs.
4. Backfilled existing `gh_social_notifications` and `ghc_economy_events` into the unified inbox.
5. Added automatic projection triggers so new legacy social/economy notifications converge without requiring every historical caller to be rewritten in Phase 32.
6. Added automatic realtime journal entries for projected social/economy notification events.
7. Added `/api/notifications` authenticated unified list/count/read API.
8. Added `/api/realtime/events` authenticated recovery API using a durable sequence cursor.
9. Added client realtime recovery that replays missed server events after reconnect/visibility recovery.
10. Upgraded Notification Center to consume the unified durable source and mark unified notifications read.
11. Preserved local notifications, system announcements, and legacy economy fallback behavior.
12. Preserved block/self-notification protections and RLS/service-role boundaries.
13. Updated migration/source-contract tooling for 126 migrations and 102 executable GreenHaven tables.
14. Added Phase 32 regression test and wired it into CI verification.

### Security model
- Notification reads always use the authenticated session identity.
- Clients cannot directly read/write notification or realtime tables.
- Service-role-only RPCs remain the database boundary.
- Actor/recipient blocks suppress notification creation.
- Realtime events do not establish wallet, payment, membership, reward or other financial truth.
- Realtime recovery validates event types through the existing domain-event allowlist before publishing them to the client event bus.
- Recovery is bounded to 100 events per request and uses authenticated recipient scoping.

### Verification
- Phase 32: 20/20
- Notification attention: 17/17
- Realtime transport hardening: 15/15
- Notification deep links: all checks passed
- Message deep links: all checks passed
- Messaging reliability: 32/32
- Social messaging regression: 15/15
- Membership/Pi convergence: 18/18
- Wallet Economy V2: 17/17
- Marketplace saves: 17/17
- Profile/social routing: 11/11
- Cross-surface integrity: 13/13
- Project integrity: 36 checks, 0 errors, 0 warnings
- Clean migration inventory: 126 unique 14-digit SQL migrations
- Database source contract: 102 executable GreenHaven tables
- Migration release readiness: PASS

### Runtime limitation
This source workspace does not contain installed dependencies/runtime credentials. Therefore this phase does NOT claim successful Next.js build/typecheck/lint, live Supabase execution, Vercel deployment, or Pi Testnet E2E. Those belong to the later build/runtime/Testnet gates.

### Remaining roadmap
33. Community Platform V2 — roles, moderation, announcements, events/resources/governance, discovery and full social/economy integration.
34. Reputation + Curation Intelligence V2 — Curation Power, quality signals, weighting, abuse resistance and governed reward eligibility.
35. GH Pulse + Media Platform — durable short video, compression, playback, attention, discovery and creator integration.
36. Security, Privacy & Abuse Hardening — auth/RLS/RPC/ownership/block/mute/rate limits/idempotency/replay/payment/media hardening.
37. Performance + Mobile/Pi Browser Optimization.
38. Accessibility + World-Class UX Consistency.
39. Database & Backend Final Convergence.
40. Automated Testing & Regression Fortress.
41. Production Build + Vercel Repair.
42. Pi Testnet E2E.
43. Global Beta Readiness.
44. Pi Ecosystem Compliance + Production Release Audit.

Phase 32 is therefore an architectural convergence step, not merely a notification UI upgrade.
