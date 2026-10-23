# GREENHAVEN 0.70.3 — PHASE 33 COMMUNITY PLATFORM V2

## Objective

Turn Communities from a mixed local/session feature set into a durable, server-authoritative community platform while preserving the existing social, messaging, notification, curation and economy architecture.

## Major upgrades

### 1. Durable community governance and safety
- Added `gh_community_moderation_log` with immutable-style service-role writes, RLS deny-by-default and indexed community history.
- Added `gh_community_reports` with report reasons, lifecycle (`open → reviewing → resolved/dismissed`), resolution metadata and active-report deduplication.
- Added durable member removal/ban RPC with role hierarchy enforcement; owners cannot be removed and moderators cannot remove admins/moderators.

### 2. Durable announcements
- Added `gh_community_announcements`.
- Moderator/admin/owner authorization is enforced inside PostgreSQL.
- Announcement creation is idempotency-safe at the product layer and writes a moderation audit record.
- Active community members receive durable realtime event journal entries through the Phase 32 notification/realtime platform.

### 3. Durable community events
- Added `gh_community_events` and `gh_community_event_rsvps`.
- Server validates event time ordering, category and community membership/role.
- Creator is automatically RSVP'd as `going`.
- RSVP status is durable and returns authoritative going counts.
- Event creation also projects durable realtime events to active members.

### 4. Durable resources / knowledge hub
- Added `gh_community_resources` for documents, links, guides, templates and media references.
- Resource writes are restricted to owner/admin/moderator and reject empty resources.
- Existing community knowledge UI can now consume durable resources from the platform snapshot.

### 5. Unified Community Platform API
Added:
- `GET /api/communities/[id]/platform`
- `POST /api/communities/[id]/platform`

Supported durable actions:
- `announcement_create`
- `event_create`
- `event_rsvp`
- `resource_upsert`
- `report_create`
- `report_resolve`
- `member_remove`
- `member_ban`

Every action is authenticated, rate-limited and server-authorized. Client actor IDs are never trusted.

### 6. Community UI convergence
- Communities screen now hydrates a durable platform snapshot when a community opens.
- Announcements, events, resources, membership, pending requests and moderation summary can converge from the same server projection instead of relying only on conversation-local state.
- Existing legacy/demo board behavior remains explicitly isolated and does not become a production authority.
- Fixed the existing legacy discussion accessibility label regression without changing its isolation semantics.

### 7. Database contract update
- Migration count: **127**.
- Executable GreenHaven tables: **108**.
- Canonical installer regenerated from all 127 migrations.
- Migration inventory/manifests synchronized.
- No GHC/Pi/ledger mutation introduced by Phase 33.

## Verification

Passed:
- Phase 33 Community Platform V2: **24/24**
- Phase 5 database tools: PASS
- Phase 30 marketplace regression: **17/17**
- Phase 32 notification/realtime regression: **20/20**
- Database source contract: **108 tables / 127 migrations**
- Communities baseline: **32/32**
- Community governance: **34/34**
- Community health/safety: **20/20**
- Community moderation/digest: **30/30**
- Community authority: **14/14**
- Community lifecycle/discovery: **23/23**
- Community participation depth: **33/33**
- Phase 20 community-comment convergence: **9/9**

### Build/typecheck limitation
The extracted source workspace does not contain `node_modules`, so a real Next.js build/typecheck cannot be claimed. A global TypeScript invocation was attempted and showed the expected dependency-resolution failures (`next/server`, Node typings and installed packages); no additional Phase 33-specific type error was surfaced beyond missing dependencies.

No live Supabase, Vercel, Pi Testnet or browser E2E verification was claimed.

## Files added/changed

- `supabase/migrations/20261023030001_gh_community_platform_v2.sql`
- `app/api/communities/[id]/platform/route.ts`
- `scripts/test-phase33-community-platform-v2.mjs`
- `contexts/ghc-context.tsx`
- `components/ghc/communities-screen.tsx`
- `components/ghc/premium-community-hub.tsx`
- `package.json`
- canonical database installer
- migration checklist / verified manifest / related migration-count contracts

## Remaining roadmap

### Phase 34 — Reputation + Curation Intelligence V2
- Full Seed → Haven → Legend progression.
- Durable Curation Power/calibration integration.
- Quality signals and weighted curation without pay-to-win GHC weighting.
- Abuse resistance, reviewer integrity and server-controlled reward eligibility.

### Phase 35 — GH Pulse + Media Platform
- Durable short-video publishing and playback.
- Compression, upload recovery, media lifecycle and bandwidth controls.
- Attention/qualified-view integration.
- Creator Studio, discovery and moderation integration.

### Phase 36 — Security, Privacy & Abuse Hardening
- Full auth/RLS/RPC ownership audit.
- Block/mute/restrict enforcement across every surface.
- Rate limits, replay protection, idempotency and media security.
- Payment, messaging and social authorization convergence.

### Phase 37 — Performance + Mobile/Pi Browser Optimization
- Request coalescing and cancellation across remaining surfaces.
- Mobile memory/render optimization.
- Pi Browser compatibility and degraded-network resilience.
- Offline/online synchronization boundaries.

### Phase 38 — Accessibility + World-Class UX Consistency
- Keyboard/screen-reader coverage.
- Touch targets, focus management and motion preferences.
- Unified loading/empty/error states.
- GreenHaven visual system consistency across all modules.

### Phase 39 — Database & Backend Final Convergence
- Remove obsolete duplicate/session authorities where safe.
- Finalize migration dependency graph.
- Canonical RPC contract audit.
- Projection and reconciliation tooling.

### Phase 40 — Automated Testing & Regression Fortress
- Expand static contracts into integration suites.
- Multi-user authorization tests.
- Cross-surface lifecycle tests.
- Failure/retry/concurrency tests.

### Phase 41 — Production Build + Vercel Repair
- Install locked dependencies in clean environment.
- Full Next build/typecheck/lint.
- Resolve all real compile/build/runtime defects.
- Vercel environment and deployment verification.

### Phase 42 — Pi Testnet E2E
- Pi authentication and identity mapping.
- Pi payment intent → completion → fulfillment.
- Membership, marketplace, messaging and wallet E2E.
- Multi-user and cross-device verification.

### Phase 43 — Global Beta Readiness
- Monitoring, error handling and recovery.
- Data migration/reconciliation rehearsal.
- Performance/load testing.
- User-facing release readiness checklist.

### Phase 44 — Pi Ecosystem Compliance + Production Release Audit
- Final Pi listing utility/compliance review.
- Security/privacy audit.
- Economy/payment safety review.
- Production release gates and final evidence package.

## Release artifact

Phase 33 package will be generated from this exact source tree after all static gates pass.
