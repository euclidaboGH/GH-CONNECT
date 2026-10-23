# GREENHAVEN — PHASE 31 MESSAGING PLATFORM V2

## Status
COMPLETE — source-integrated, statically verified, no production runtime claim.

## Objective
Upgrade GreenHaven messaging from a durable DM/group foundation into a cross-surface messaging platform that can safely support private chat, community chat, marketplace transaction chat, post sharing, replies, attachments, delivery/read state, privacy, presence, pagination and recovery.

## Major upgrades

### 1. Durable conversation context
Added first-class conversation context fields:
- `context_type`
- `context_id`
- `avatar_url`
- `last_message_id`
- member count projection

Context is server-authoritative and supports:
- marketplace orders
- communities
- posts
- system conversations

Added `gh_messaging_set_conversation_context` with membership authorization and service-role-only execution.

### 2. Stable message pagination
Messaging now supports a composite `(created_at, id)` cursor rather than relying only on timestamps. This prevents same-timestamp rows from being skipped or duplicated during history pagination.

Added:
- `idx_gh_messages_conversation_created_id`
- `beforeId` API parameter
- server-side composite cursor handling
- client helper support for `beforeId`

### 3. First-class reply/share references
Messages now have durable first-class columns for:
- `reply_to_message_id`
- `shared_type`
- `shared_id`

Existing JSON metadata remains backward compatible. Post sharing continues to use server-side audience/block validation.

### 4. Delivery acknowledgement
Added `gh_messaging_mark_delivered` for bounded, idempotent delivery acknowledgement. Delivery remains separate from read state; the server never treats a fetched message as read automatically.

### 5. Marketplace transaction chat
Added:
`POST /api/marketplace/orders/[orderId]/conversation`

The route:
- authenticates the caller
- loads the authoritative marketplace order
- permits only the buyer or seller
- creates/reuses the deterministic direct conversation
- attaches durable `marketplace_order` context
- returns the conversation identity for exact navigation

Marketplace Orders now expose a **Chat** action so buyers and sellers can enter the correct transaction conversation directly.

### 6. Cross-surface navigation
Marketplace → Messaging now uses the existing global conversation routing contract. This avoids creating a second chat system for marketplace transactions.

### 7. Personal inbox state
The Phase 31 schema preserves per-member:
- pin state
- archive state
- mute state
- read cursor

Conversation context is global; inbox preferences remain personal.

## Security model
- Authentication remains session/server authoritative.
- Conversation membership is checked before reads/writes.
- Marketplace chat is buyer/seller ownership gated.
- Direct messaging still enforces block and recipient privacy policy.
- RLS remains fail-closed for direct client table access.
- Service-role-only RPCs are used for privileged messaging operations.
- Message attachments continue to require server-side owned-media validation.
- Post sharing continues to validate visibility and block relationships server-side.

## Verification
### Phase 31
14/14 PASS.

### Messaging regressions
- Messaging server-first: PASS
- Messaging reliability: 32/32 PASS
- Message deep links: PASS
- Social comments/replies/messaging: 15/15 PASS

### Previous critical regressions
- Phase 30 Marketplace Commerce V2: 17/17 PASS
- Phase 29 Membership + Pi Payment Convergence: 18/18 PASS
- Phase 28 Wallet Economy V2: 17/17 PASS
- Phase 12 Marketplace Saves: 17/17 PASS
- Phase 13 Profile/Social Routing: 11/11 PASS
- Phase 16 Cross-Surface Integrity: 13/13 PASS
- Project integrity: 36 checks, 0 errors, 0 warnings
- Migration release readiness: PASS
- Clean migration inventory: 125 unique 14-digit SQL migrations

## Runtime/build limitation
`node_modules` is not present in the supplied source workspace. Therefore this phase does **not** claim a Next.js production build, TypeScript compilation, ESLint run, live Supabase execution, Vercel deployment, Pi Testnet E2E, or Mainnet verification.

The canonical installer was regenerated successfully and contains 125 migrations.

## Files added/changed
- `supabase/migrations/20261023010003_gh_messaging_v2.sql`
- `app/api/marketplace/orders/[orderId]/conversation/route.ts`
- `app/api/messaging/conversations/[conversationId]/messages/route.ts`
- `lib/server/messaging/message-store.ts`
- `lib/messaging/server-messaging-sync.ts`
- `components/ghc/marketplace-screen.tsx`
- `scripts/test-phase31-messaging-platform-v2.mjs`
- `scripts/check-clean-migrations.mjs`
- `scripts/test-phase30-marketplace-commerce-v2.mjs`
- `package.json`
- regenerated `supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql`

## Complete remaining roadmap

### Phase 32 — Notification + Realtime Event Platform
One durable event pipeline across social, messaging, marketplace, creator, wallet and membership with exact deep links, deduplication, read state, refresh/reconnect and server-authoritative event identity.

### Phase 33 — Community Platform V2
Roles, moderation, announcements, events, resources, governance, discovery and complete integration with the canonical social/curation/economy system.

### Phase 34 — Reputation + Curation Intelligence V2
Seed → Haven → Legend progression, Curation Power, quality signals, weighted curation, abuse resistance and server-controlled eligibility without pay-to-win GHC weighting.

### Phase 35 — GH Pulse + Media Platform
Short video, durable uploads, compression, playback, attention, discovery, creator integration, moderation hooks and mobile bandwidth optimization.

### Phase 36 — Security, Privacy & Abuse Hardening
Full auth/RLS/RPC/ownership/block/mute/rate-limit/idempotency/replay/payment/media security audit and fixes.

### Phase 37 — Performance + Mobile/Pi Browser Optimization
Request deduplication, cache boundaries, rendering performance, low-bandwidth behavior, lifecycle recovery and Pi Browser compatibility.

### Phase 38 — Accessibility + World-Class UX Consistency
Keyboard/screen-reader support, contrast, touch targets, loading/error/empty states, design-token convergence and cross-surface UI polish.

### Phase 39 — Database & Backend Final Convergence
Eliminate duplicate authority, reconcile historical migrations, finalize RPC contracts, indexes, RLS and canonical installer.

### Phase 40 — Automated Testing & Regression Fortress
Expand static, unit, integration, browser and multi-user tests; create release-blocking regression gates.

### Phase 41 — Production Build + Vercel Repair
Install/verify dependencies, typecheck, lint, Next build, environment separation and Vercel deployment repair.

### Phase 42 — Pi Testnet E2E
Authenticated multi-user Testnet verification for Pi login, payments, marketplace, membership, wallet, messaging and cross-surface flows.

### Phase 43 — Global Beta Readiness
Operational monitoring, support/recovery flows, data safety, performance and controlled beta gates.

### Phase 44 — Pi Ecosystem Compliance + Production Release Audit
Final Pi utility/compliance review, privacy/security review, payment safety, production release checklist and Mainnet readiness.

## Release principle
No feature is considered complete merely because UI exists. GreenHaven continues to require one authoritative server path, durable persistence, authorization, idempotency, cross-surface synchronization and regression coverage before a phase is considered finished.
