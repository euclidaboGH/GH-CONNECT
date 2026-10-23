# GREENHAVEN — PHASE 40 REGRESSION FORTRESS

## Objective

Turn the completed backend convergence architecture into a broad, repeatable release-safety layer. Phase 40 verifies that the canonical authorities established in Phases 30–39 remain connected across social, economy, payments, membership, marketplace, messaging, notifications, communities, media, reputation, creator economy, activity attribution and realtime recovery.

## Major upgrades

### 1. Shared Daily Claim state coordinator

Replaced per-component Daily Claim polling with a process-wide server-authoritative coordinator:

- `lib/rewards/daily-claim-status-store.ts`
- single-flight requests
- stale-response protection
- one polling interval per active user rather than one interval per mounted hook
- focus/online/visibility refresh
- claim-event refresh
- Lagos reward-day rollover detection
- last confirmed server state preserved during transient failures

`useDailyClaimStatus` now subscribes to this shared coordinator through React's external-store contract.

### 2. Regression Fortress contract matrix

Added:

`scripts/test-phase40-regression-fortress.mjs`

It covers 50 critical contracts across:

- Phase 39 backend convergence
- Daily Claim authority
- social/feed/comments
- curation/reputation
- identity/profile
- wallet/economy
- payments/membership
- marketplace commerce
- creator economy
- messaging
- notifications/realtime
- communities
- media
- security/abuse
- cross-surface synchronization
- race-condition protection
- release gates

### 3. CI integration

Phase 40 is now part of `ci:verify`.

### 4. Stale regression contract repair

The Phase 37 test still expected the legacy feed engagement fallback that Phase 39 intentionally removed. The regression contract was corrected to assert the new canonical behavior instead of reintroducing obsolete architecture.

The Phase 30 marketplace regression test also referenced an obsolete migration filename. It now points at the canonical `20261022130001_marketplace_commerce_v2.sql` migration.

## Verification

- Phase 40 Regression Fortress: **50/50**
- Phase 39 convergence: **26/26**
- Phase 39 backend tests: **18/18**
- Phase 38 accessibility: **14/14**
- Phase 37 performance/mobile: **18/18**
- Phase 36 security/privacy/abuse: **19/19**
- Phase 35 Pulse/media: **17/17**
- Phase 34 reputation/curation: **18/18**
- Phase 33 community platform: **24/24**
- Phase 32 notification/realtime: **20/20**
- Phase 31 messaging: **14/14**
- Phase 30 marketplace: **17/17**
- Phase 25 feed/discovery: **13/13**
- Project integrity: **36/36**, 0 errors, 0 warnings
- Migration inventory: **131/131**
- Database source contract: **114 executable tables / 131 migrations**
- Migration release readiness: **PASS**

## Runtime boundary

This phase does not claim a real production Next.js build, TypeScript compilation, ESLint execution, browser E2E, live Supabase execution, Vercel deployment, or Pi Testnet transaction. The current source package does not contain an installed production dependency environment or live credentials. Those runtime gates remain explicitly assigned to the subsequent production/testnet phases.

## Next roadmap

### Phase 41 — Production Build + Vercel Repair

- Node 24 clean dependency environment
- npm clean install
- TypeScript
- ESLint
- Next production build
- actual build-error repair
- Vercel environment reconciliation
- Preview/Testnet vs Production/Mainnet separation
- deployment smoke tests

### Phase 42 — Pi Testnet E2E

- Pi authentication/session
- wallet connection
- Pi payment lifecycle
- membership entitlement reconciliation
- marketplace payment/order lifecycle
- GHC wallet
- Daily Claim pending/redemption lifecycle
- messaging
- media
- notifications/deep links
- mobile/Pi Browser validation

### Phase 43 — Global Beta Readiness

- multi-device
- low bandwidth
- performance budgets
- abuse/security
- observability
- recovery/runbooks
- reconciliation
- beta evidence

### Phase 44 — Pi Ecosystem Compliance + Production Release Audit

- ecosystem listing
- utility-first compliance
- Pi SDK/backend verification
- privacy/security
- final database reconciliation
- production evidence
- Mainnet checklist
- rollback readiness
