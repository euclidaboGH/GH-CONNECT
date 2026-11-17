# GREENHAVEN Project Bookkeeper — 2026-11-09

## Current baseline

- Uploaded archive: `GREENHAVEN-0.338.8-wallet-redesign-payout (4).zip`
- Archive SHA-256: `4b770c79f4f271a707f65c7e3c58e24d1c01674df5b7c0dccc6eaa1aae630a41`
- Actual root folder: `GREENHAVEN-0.338.6/`
- `package.json` version: `0.338.6`
- `package-lock.json` root version: `0.338.6`
- `docs/CURRENT_BUILD_CONTEXT.md`: `0.338.6`
- `docs/SOURCE_OF_TRUTH.md` header: stale `0.330.48`
- Node requirement: `^24.15.0`; `.nvmrc`: `24.15.0`
- Next.js: `15.5.26`; React: `19.x`
- Production: **NOT APPROVED**

## Archive inventory (observed)

| Inventory | Count |
|---|---:|
| API route files | 230 |
| `lib/` files | 521 |
| `features/` files | 34 |
| `components/ghc/` files | 195 |
| Supabase migration SQL files | 198 |
| `.mjs` / `.ts` engineering scripts | 387 |

These are archive file counts, not acceptance or completion metrics.

## Current engineering position

- The repository is a modular Next.js/React application with Supabase/PostgreSQL persistence and server-side API/RPC boundaries.
- The product has an existing 11-priority product roadmap and a 15-section × 10-essential maintenance programme. These remain active historical/project registers and must not be overwritten by the new strategic roadmap.
- Pi and GHC remain separate assets, ledgers, units and payment rails.
- Wallet/payout/rewards/membership/marketplace workflows contain server-authoritative controls and require external runtime/operator verification.
- Existing project records explicitly require Node 24.15.x dependency-backed checks, PostgreSQL migration/concurrency rehearsal, authenticated Supabase integration, Pi Testnet lifecycle evidence and browser/device acceptance.
- Remote Web Push remains disabled/not configured; do not enable without vetted sender/worker, secrets and provider/device acceptance.
- Migrations marked `REVIEW_REQUIRED`, `PROPOSAL` or `REQUIRES_APPROVAL` remain held. No migration was applied by this roadmap exercise.

## New strategic work product

Added `docs/STRATEGIC-ROADMAP-50-30-2026-11-09.md`:
- 50 project-wide improvement opportunities.
- 30 selected for implementation in 3 phases of 10 work packages.
- 20 deferred opportunities with explicit safety/dependency rationale.
- Compatibility and architecture recommendations.
- Standards, official platform references and universal acceptance gates.

This document is a proposal and audit artifact, not an implementation completion claim.

## Baseline inconsistencies requiring reconciliation

1. Archive filename indicates 0.338.8, but executable package/lockfile/root folder/current build context indicate 0.338.6. Do not bump or relabel the release without reconciling all release metadata and CI/Vercel identity.
2. `docs/SOURCE_OF_TRUTH.md` current-version header and some current-release facts are stale relative to 0.338.6.
3. Actual migration directory contains 198 SQL files; historical docs report different totals. Regenerate/reconcile the manifest and migration status inventory against the actual tree and target DB histories.
4. `package.json` still uses `gh-connect` as its package identifier. Do not mass-rename package or deployment identifiers without dependency and compatibility analysis; maintain GreenHaven as the user-facing brand.
5. The 0.338.6 source worklog says source-only verification; do not claim Node 24 build, live database, Testnet, device or production acceptance unless fresh evidence is recorded.

## Phase I implementation update (2026-11-09)

Added `docs/PHASE-I-IMPLEMENTATION-2026-11-09.md` with package-by-package status and evidence. Source changes in this pass:
- Extended `lib/architecture/domain-ownership.ts` with rewards, communities, notifications, trust/safety and payment ownership; added rewards/payments to protected financial domains.
- Added pure PI atomic arithmetic and overflow-safe fee preview in `lib/wallet/pi-atomic.ts`.
- Hardened `lib/server/earnings/unified-ledger.ts` to reject malformed atomic amounts, incomplete ledger identities, invalid payout request identifiers, invalid gross/fee/net arithmetic and non-Testnet payout request network values before RPC calls.
- Added 15-check Phase I source/inventory gate and 22 PI atomic arithmetic assertions.
- Registered the Phase I gate in `prebuild`, `verify:static` (where present) and `check:phase1-strategic-foundations`.
- Updated the existing ledger regression gate to follow the shared PI atomic helper.
- No SQL migration was created or applied; no financial row or provider action was touched.

**Phase I is still IN PROGRESS.** The transactional outbox and backup/restore proof are not complete; other packages remain partially accepted pending live database, Testnet, operator and device evidence. See `docs/PHASE-I-IMPLEMENTATION-2026-11-09.md`.

## Work performed in the roadmap preparation pass

- Inspected archive identity, checksum, top-level project layout, package metadata, current build context, source-of-truth document, product roadmap, maintenance register, acceptance register, Pi A2U compliance checklist and reserved-funds diagnostic.
- Counted API, feature, library, component, migration and engineering-script inventory.
- Researched official security, accessibility, performance, Supabase, PostgreSQL, Pi Platform API, observability, supply-chain and community moderation references.
- Added the strategic 50/30/3-phase roadmap.
- The strategic roadmap preparation pass made no executable application source changes; a subsequent Phase I implementation pass made the source changes listed above.
- No package version changed.
- No dependency install, typecheck, lint, production build or device test was run in this bookkeeping pass.
- No database migration was added, edited, applied or reordered.
- No Supabase, Pi, Vercel or GitHub production action was performed.
- No financial record, wallet balance, payout request, reservation or ledger entry was changed.

## Next controlled sequence

1. Complete the transactional outbox design, database transaction boundaries, migration proposal and disposable-PostgreSQL concurrency/replay tests.
2. Complete backup artifact verification, isolated restore, PITR and recovery exercise.
3. Continue domain duplicate-writer enforcement, cross-feature ledger property tests, identity recovery E2E, authorization/IDOR testing, rewards abuse tests and moderation operations acceptance.
4. Reconcile all 198 source migrations with target Testnet and Mainnet histories; apply nothing without reviewed per-environment approval.
5. Run Node 24.15.x install/typecheck/lint/build and full registered tests.
6. Complete authenticated Supabase, Pi Testnet, Vercel Preview, operator and device acceptance before any production approval.

**Current state:** Phase I source hardening delivered, but Phase I remains **IN PROGRESS**. Production remains **NOT APPROVED**.

## Follow-up source hardening — 2026-11-09

Added a route-level domain write-owner registry and gate covering 150/150 mutating API route handlers. Added a proposal-only PostgreSQL transactional outbox design, server-side worker transport, disposable PostgreSQL rehearsal SQL, outbox static gate, and a consolidated live-acceptance runbook. Registered the two new static gates in package scripts. Package release remains unchanged at 0.338.6; no lockfile/dependency change.

Files added/updated in this follow-up:
- `lib/architecture/domain-mutation-route-owners.json`
- `scripts/check-domain-mutation-route-owners.mjs`
- `docs/proposals/PHASE-I-TRANSACTIONAL-OUTBOX-DESIGN.sql` (proposal; not a migration)
- `lib/server/outbox/transactional-outbox.ts`
- `supabase/tests/phase1_transactional_outbox_rehearsal.sql` (not executed; disposable DB only)
- `scripts/check-phase1-outbox-contract.mjs`
- `docs/operations/PHASE-I-LIVE-ACCEPTANCE-RUNBOOK.md`
- `package.json` (two npm check scripts and prebuild/static registrations)
- `docs/PHASE-I-IMPLEMENTATION-2026-11-09.md`

No database migration was added to the live migration tree, no migration was applied, no Supabase/Pi/Vercel environment was contacted, and no financial/user record or provider transaction was changed. The new route-owner registry is not proof of one SQL writer per command. External operational work remains outstanding as documented in the Phase I implementation report.

## Phase II implementation pass 1 — 2026-11-09

Started the strategic Phase II programme from the verified Phase I output archive (SHA-256 `854903bb8c7567886ec4e7016dede501fa99b817592d72f60ef9c25052bfeb2b`).

Implemented:
- Unified block/mute suppression in every feed lane, including Following, Nearby, Trending, Latest and Saved.
- Saved lane now excludes drafts and scheduled content.
- Latest lane is strictly chronological; removed the following-status score bonus that could reorder near-timestamp posts.
- Deterministic feed ranking tie-break by timestamp and post ID.
- Added `scripts/check-phase2-feed-safety-controls.mjs` (12 source-contract checks), registered in prebuild, verify:static and `check:phase2-feed-safety`.

Verified in this pass:
- Phase II feed safety gate: 12/12.
- Existing feed reconciliation: 12/12.
- Existing visual cohesion: 9/9.
- Existing messaging/notifications: 18/18.

Phase II status remains IN PROGRESS. Existing source coverage across design system, feed, creator studio, communities, discovery, messaging, notifications and marketplace was audited and summarized in `docs/PHASE-II-IMPLEMENTATION-2026-11-09.md`. Live acceptance and device performance evidence are still outstanding.

No migration, dependency or package version changed. No wallet, financial, reward, payment, payout, refund, order settlement or entitlement record changed. Remote push and Mainnet remain disabled/not approved. Node 24.15.x full build/typecheck/lint has not been run in this workspace.


## Phase II implementation pass 2 — shared design system and adaptive shell (2026-11-09)

**Work package:** #11 Unified premium design system and adaptive app shell.

**Source changes:**
- `app/globals.css`: added shared spacing/type/layout/control/dialog/focus tokens; shared page/section/card primitives; explicit type helpers now consume the token scale; ultra-wide desktop shell is bounded and centered while phone layouts remain edge-to-edge.
- `lib/design-system.ts`: connected JS spacing, radius, typography and component contracts to CSS variables; corrected semantic color exports to use complete CSS variables directly rather than invalid `hsl(var(--...))` wrappers.
- `components/ghc/app.tsx`: shared tab loading fallback now uses the page-container primitive.
- `scripts/check-phase2-design-system-adaptive-shell.mjs`: 15 source-contract assertions; registered in `prebuild`, `verify:static` and `check:phase2-design-system`.
- `scripts/check-doc-hygiene.mjs`: classified the current 0.330.50–0.338.6 worklogs and Phase I acceptance runbook; recognizes the active 2026-11-09 engineering notes.
- `docs/PHASE-II-DESIGN-SYSTEM-ADAPTIVE-SHELL-2026-11-09.md`: implementation, compatibility and acceptance record.

**Verification:** design-system/adaptive-shell 15/15; visual cohesion 9/9; Phase 5 design system 23/23; Phase 25 premium UI 10/10; Phase II feed safety 12/12; Pass 40 feed reconciliation 12/12. These are source-level checks. No full Node 24.15.x install/typecheck/lint/build or browser/device screenshot acceptance was run.

**Safety:** no logo assets, package version, dependencies, lockfile, migrations, navigation destinations, APIs, data contracts, wallet/payment/reward/payout/refund/order/entitlement logic or records changed.

**Status:** Phase II #11 implementation pass 1 delivered; cross-surface migration and responsive/device acceptance remain open. Phase II IN PROGRESS. Production NOT APPROVED.

**Phase II pass 2 packaged artifact:** `GREENHAVEN-0.338.6-PHASE-II-PASS-2-DESIGN-SYSTEM.zip` — archive integrity verified with `unzip -t`; SHA-256 `4f6cf8f00ba2e9cba9add072504cee20f70258b377af9a755b9dfcc3e51ce5f7`. Internal root remains `GREENHAVEN-0.338.6/`. Package version remains 0.338.6.


## Phase II implementation pass 3 — feed controls, ranking and constrained-device rendering (2026-11-09)

**Work packages:** #11 shared design system/adaptive shell follow-up; #12 feed quality and topic control; #13 media/rendering/performance.

**Implemented:**
- Feed screen now supplies durable `mutedUsers` and settings muted-user IDs to the ranking engine; block/mute filters therefore apply to actual feed input, not just the ranking API contract.
- Topic tags are normalized and bounded. Users can select a topic to narrow any feed lane, mute a topic to exclude it from every lane, and restore muted topics even after all matching posts disappear. Preferences are scoped by account on this device.
- Engagement inputs are finite, non-negative and bounded before scoring; future timestamps cannot create artificial freshness boosts; age decay is numerically bounded.
- Adaptive feed batch is 3 on constrained devices, 5 on default devices and 7 on higher-core devices; initial SSR markup remains deterministic and adapts after hydration.
- First visible feed-card image can be eagerly prioritized; other images remain lazy with responsive size hints. Feed video now sets `preload=none`. Signed media URLs are not rewritten.
- Additional shared type/card token migration on feed, messages and marketplace.
- Added `scripts/capture-phase2-responsive-screenshots.mjs` and `docs/PHASE-II-DEVICE-ACCEPTANCE-MATRIX-2026-11-09.md` for 7 viewports × 2 themes, canonical nav screenshots, overflow detection and physical Android/Pi Browser checks.
- Added Creator Studio draft continuity using the existing local draft store and composer event contract. Draft storage is now scoped by `IdentityService.getCurrentUserId()`; unowned legacy v1 drafts are not imported into another account. Scheduled publishing remains explicitly unavailable; no scheduler or automatic publication was added.
- Added `scripts/check-phase2-feed-controls-performance.mjs` (29 source-contract assertions) and `scripts/check-phase2-creator-drafts.mjs` (12 assertions), registered in `prebuild` and `verify:static`. Added `npm run capture:phase2-responsive` and `npm run check:phase2-creator-studio`.

**Verification:** Creator Studio draft contract 12/12; feed controls/performance 29/29; adaptive design system 15/15; feed safety 12/12; feed reconciliation 12/12; visual cohesion 9/9; design system 23/23; premium UI 10/10; messaging/notifications 18/18; communities/discovery 15/15; marketplace commerce 15/15; seller experience 9/9; marketplace integrity 30/30; repository consistency 6/6.

**Not run:** Node 24.15.x dependency install, TypeScript typecheck, lint, production build, Playwright screenshots, physical Android testing and Pi Browser testing. No preview URL, auth storage state, installed dependencies/browser or physical device was available. See the acceptance matrix.

**Safety:** no financial/wallet/payment/payout/refund/order/reward/entitlement logic or records changed; no database migration, dependency, lockfile or package version changed; remote push and Pi Mainnet remain disabled/not approved.

**Status:** Phase II #11–14 source improvements advanced; #15–20 foundations exist but still require focused source work and/or external acceptance. Phase II IN PROGRESS. Production NOT APPROVED.
