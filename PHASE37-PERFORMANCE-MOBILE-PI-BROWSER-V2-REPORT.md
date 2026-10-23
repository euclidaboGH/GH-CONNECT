# GREENHAVEN — PHASE 37 PERFORMANCE, MOBILE & PI BROWSER V2

## Scope

Phase 37 is a platform-wide performance convergence pass. It reduces server round trips, controls background polling, improves media delivery, makes mobile/low-power decisions explicit, and strengthens request single-flight behavior without changing business authority.

## Major upgrades

### 1. Feed engagement batch V2
- Added `gh_post_feed_engagement_batch(text[], text)` as a service-role-only SECURITY DEFINER RPC.
- Collapses post comments, comment-reaction previews, post reactions, viewer reaction state, curation counts and viewer curation state into one database operation for up to 50 posts.
- Feed API prefers the batch RPC and retains a compatibility fallback for databases that have not received the new migration.
- Stable cursor pagination and canonical visibility enforcement remain unchanged.
- No wallet, GHC, Pi or client authority is exposed by the batch projection.

### 2. Mobile/low-power performance profile
- Added `getDevicePerformanceProfile()` for Save-Data, effective connection type, reduced-motion, CPU and memory signals.
- Added `shouldPrefetchNonCritical()` to prevent wasteful prefetching on low-power/data-constrained devices.
- Added `scheduleNonCriticalWork()` for post-paint/idle scheduling.
- Existing pagination, video lazy-loading and reduced-data helpers remain compatible.

### 3. Media delivery optimization
- `MediaWithRetry` now uses the canonical image sizing helper.
- Images request a smaller width on Save-Data/slow connections.
- Added asynchronous image decoding and low-priority loading hints.
- Blob URLs continue to be rejected by the durable media renderer.

### 4. Request single-flight correctness
- Fixed `cachedFetch()` so it is truly single-flight rather than accidentally retaining resolved/rejected promises indefinitely.
- Failed requests are removed automatically.
- This utility remains a request coalescer, not a stale response cache.

### 5. Connection monitoring optimization
- Connection monitoring is now demand-driven.
- No permanent 30-second timer is created merely because the module is imported.
- Connectivity checks run only while consumers are subscribed and the page is visible.
- Background checks are reduced to a 60-second cadence.
- Browser online/offline events remain immediate.

### 6. Notification polling optimization
- Notification polling is now visibility-aware.
- Hidden tabs stop polling.
- Visible background badge refresh uses a 30-second cadence.
- Open notification center retains the faster 12-second cadence.
- Returning to the foreground triggers an immediate refresh.

## Database contract

- Clean migration inventory: **131**
- Executable GreenHaven tables: **114**
- Canonical Supabase installer regenerated.

## Verification

- Phase 37 performance/mobile checks: **18/18 PASS**
- Phase 36 security checks: **19/19 PASS**
- Phase 35 GH Pulse/media: **17/17 PASS**
- Phase 34 reputation/curation: **18/18 PASS**
- Phase 33 community platform: **24/24 PASS**
- Project integrity: **36/36 PASS**
- Project integrity errors: **0**
- Project integrity warnings: **0**
- Migration naming/readiness: **PASS**
- Database source contract: **114 executable tables / 131 migrations**

## Runtime boundary

This phase does not claim a real Next.js production build, TypeScript compiler run, browser E2E, live Supabase execution, Vercel deployment or Pi Testnet execution. The supplied source environment does not contain the required installed Node 24 dependency/runtime and live credentials for those gates.

Those remain explicit production validation gates rather than being marked as passed from static source checks.

## Remaining roadmap

### Phase 38 — Accessibility + World-Class UX Consistency
- unified spacing/typography/interaction standards
- keyboard and screen-reader navigation
- focus management
- touch targets and safe-area behavior
- loading/error/empty-state consistency
- reduced-motion support
- visual hierarchy and component convergence

### Phase 39 — Database & Backend Final Convergence
- remove legacy duplicate paths
- reconcile fallback RPCs
- normalize domain adapters
- consolidate server stores
- finalize migration dependencies
- remove dead/obsolete persistence paths

### Phase 40 — Automated Testing & Regression Fortress
- comprehensive unit/integration contracts
- route authorization matrix
- cross-surface lifecycle tests
- economy/payment invariants
- media and messaging E2E
- mobile/browser regression matrix

### Phase 41 — Production Build + Vercel Repair
- Node 24 clean install
- TypeScript/build/lint
- Vercel build failures
- environment contract validation
- production bundle and runtime verification

### Phase 42 — Pi Testnet E2E
- Pi authentication
- wallet connection
- payments
- marketplace purchase/escrow
- membership entitlement
- messaging
- social/creator/economy paths

### Phase 43 — Global Beta Readiness
- observability
- recovery procedures
- performance budgets
- operational dashboards
- support/admin workflows
- controlled beta gates

### Phase 44 — Pi Ecosystem Compliance + Production Release Audit
- ecosystem listing consistency
- Pi Browser compatibility
- utility and transaction language review
- security/privacy release audit
- production migration reconciliation
- final release evidence
