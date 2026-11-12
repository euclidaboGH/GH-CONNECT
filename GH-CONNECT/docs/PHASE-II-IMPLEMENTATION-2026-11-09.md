# Phase II — Premium Product and Ecosystem Experience (Implementation Pass 1)

**Date:** 2026-11-09  
**Baseline:** GREENHAVEN 0.338.6  
**Input archive:** `GREENHAVEN-0.338.6-PHASE-I-OUTBOX-AND-ACCEPTANCE.zip`  
**Input SHA-256:** `854903bb8c7567886ec4e7016dede501fa99b817592d72f60ef9c25052bfeb2b`  
**Status:** IN PROGRESS — first feed safety implementation delivered; remaining packages require implementation and/or live acceptance.

## Scope

This pass begins Phase II of `STRATEGIC-ROADMAP-50-30-2026-11-09.md`. It does not claim completion of all ten Phase II work packages. Existing feature work and historical phase gates were audited so new changes could target actual gaps rather than duplicate existing capabilities.

## Source audit findings

The baseline already contains substantial source implementation in all ten Phase II areas:

- Design themes and shared app shell, plus visual cohesion checks. The Phase II #11 follow-up adds a shared runtime token scale, fixes invalid semantic color wrappers, and bounds ultra-wide shell width; see `PHASE-II-DESIGN-SYSTEM-ADAPTIVE-SHELL-2026-11-09.md`.
- Feed ranking, Following/Latest/For You lanes, feed reconciliation, pagination, media prefetch bounds, reduced-data controls and “Why am I seeing this?” UI.
- Creator Studio with server-sourced creator profile, published post metrics and read-only economy snapshots.
- Community membership/governance adapters, role checks and moderation-related persistence.
- Discovery ranking, filtering and explainability components.
- Authenticated messaging, conversation membership checks, client message idempotency and bounded offline retries.
- Unified in-app notifications and notification preferences; remote push remains disabled/not production accepted.
- Marketplace variants, inventory/fulfilment, trust presentation and operational dispute/refund source.
- Order lifecycle and payment verification boundaries.

These are source capabilities, not proof of live provider delivery, operational moderation, marketplace end-to-end acceptance or device performance.

## Implemented in this pass

### Feed safety and ordering consistency

Updated `lib/feed-ranking-engine.ts`:

1. Added one shared blocked/muted author suppression policy.
2. Applied that policy to For You, Following, Nearby, Trending, Latest and Saved lanes. Friends and Communities retain their existing combined block/mute enforcement.
3. Ensured Saved excludes drafts and scheduled posts in addition to blocked/muted authors.
4. Removed the Following-status score bonus from Latest. Latest now means strictly chronological ordering.
5. Added a deterministic tie-breaker for equal scores: post timestamp, then stable post ID.

Why this matters: a user block or mute is a hard product-safety control, not a soft ranking signal. Previously, Following, Nearby, Trending, Latest and Saved could still surface posts from muted authors; Latest also added a small following bonus that could reorder posts with very close timestamps.

### Automated guard

Added `scripts/check-phase2-feed-safety-controls.mjs` with 12 source-contract assertions and registered it in `prebuild`, `verify:static` and `check:phase2-feed-safety`.

## Verification performed

- Phase II feed safety source-contract gate: 12/12 passed.
- Existing Pass 40 feed reconciliation gate: 12/12 passed.
- Existing Phase 2 visual cohesion gate: 9/9 passed.
- Existing Phase 5 messaging/notifications gate: 18/18 passed.

The above are source-level gates. No Node 24.15.x install/typecheck/lint/build, real-device test, live Supabase, Pi provider, remote push, marketplace Testnet lifecycle or production acceptance was performed in this pass.

## Phase II work-package status

| # | Work package | Current position |
|---|---|---|
| 11 | Unified premium design system and adaptive app shell | Shared spacing/type/layout tokens and adaptive shell delivered; high-traffic feed/messages/marketplace title and card surfaces migrated; responsive screenshot harness and Android/Pi Browser matrix added. Physical screenshot/device acceptance remains pending. |
| 12 | Feed quality, relevance and user control | Hard block/mute suppression wired to durable muted-user state across lanes; strict Latest ordering; per-account topic include/mute/restore controls; finite bounded engagement inputs and future-time freshness guards. Ranking telemetry/controlled experiments remain pending. |
| 13 | Feed rendering, scrolling and media pipeline | Adaptive initial batch (3 constrained / 5 standard / 7 higher-capability), SSR-safe post-hydration adaptation, first visible image priority, responsive image size hints, no metadata preload on feed videos, reduced-data prefetch guard. Real device traces, CDN variants and long-session memory acceptance remain pending. |
| 14 | Creator Studio and sustainable creator economy | Added Creator Studio draft list/open/delete integration using the existing composer contract; drafts are now account-scoped on shared devices. Scheduled publishing remains disabled until a durable server queue and operator controls are designed and accepted. Server-sourced analytics/economy remain read-only. |
| 15 | Community governance and healthy participation | Existing governance/membership foundations; needs full moderator queue, appeals, abuse workflow and role-change live acceptance |
| 16 | Discovery and matching with consent and explainability | Existing ranking/filtering and reason components; needs explicit opt-in controls, reset/tune flows and privacy/IDOR acceptance |
| 17 | Messaging reliability and privacy | Existing membership, idempotency and offline retry gates; needs attachment scanning, delivery-state semantics, block/report and retention acceptance |
| 18 | Notification delivery and attention controls | Existing unified inbox/preferences; remote push intentionally remains disabled pending sender, secrets, provider and device acceptance |
| 19 | Marketplace trust and seller quality | Existing report/trust primitives; needs evidence-backed seller tiers, case workflow, seller response signals and high-risk restriction review |
| 20 | Commerce lifecycle and buyer/seller protection | Existing order/fulfilment/dispute/refund source; needs disposable-Postgres concurrency and full provider-backed Testnet acceptance |

## Safety and compatibility

- No financial code, wallet records, reward credits, order payments, refunds, payouts or entitlements were changed.
- No database migration was added or applied.
- No external push sender or Mainnet capability was enabled.
- No dependencies or package version changed.
- Existing GREENHAVEN branding and logo assets were preserved.
- Internal package version remains 0.338.6.

## Next implementation order

1. Complete Phase II #12/#13 with behavior-level ranking tests and feed/media performance instrumentation that is safe to ship dark.
2. Continue #11 by migrating high-traffic surfaces to shared primitives and performing screenshot/device regression across themes and breakpoints.
3. Complete #16 privacy/consent controls and #17 message safety/reliability.
4. Complete #15 moderator operations and #19 seller/listing trust cases.
5. Complete #14 creator analytics/drafts/scheduling and #18 notification attention controls.
6. Complete #20 commerce lifecycle tests against disposable PostgreSQL and Pi Testnet-compatible payment boundaries.
7. Run full Node 24.15.x verification and device/preview acceptance.

**Production remains NOT APPROVED.**


## Phase II implementation pass 2 — shared design system and adaptive shell (2026-11-09)

Implemented Phase II work package #11 pass 1. Added runtime spacing and type tokens, page/content gutters, card/control/dialog/focus tokens, reusable page/section/card primitives, ultra-wide shell bounds and shared loading-fallback layout. Corrected invalid `hsl(var(--primary))`-style exports because semantic variables already contain full CSS colors. Added and registered a 15-check design-system/adaptive-shell gate. Updated the documentation hygiene register to classify the current release worklogs and Phase I live-acceptance runbook; the hygiene gate now passes.

Verification: new gate 15/15; visual cohesion 9/9; Phase 5 design system 23/23; Phase 25 premium UI 10/10; Phase II feed safety 12/12; Pass 40 reconciliation 12/12. Cross-device screenshots, browser/device tests, Node 24.15.x install/typecheck/lint/build remain outstanding.

No logo, dependency, package version, lockfile, migration, navigation destination, data contract or financial authority changed. Phase II remains IN PROGRESS; production remains NOT APPROVED.


## Phase II implementation pass 3 — topic controls, feed ranking hygiene and constrained-device rendering (2026-11-09)

Implemented additional safe local source improvements across Phase II #11–13:

- Connected the durable `mutedUsers` state from `useGHCFeed()` into `FeedContext.mutedUserIds`, including settings fallback. This closes the gap where the ranking engine had block/mute filtering support but the feed screen did not supply its muted-user list.
- Added normalized hashtag/topic extraction and deterministic include/exclude topic controls. Topic exclusions are hard filters across For You, Following, Nearby, Trending, Latest, Friends, Communities and Saved; a selected topic narrows the active lane. Preferences are device-local and account-keyed. Muted topics can always be restored from a dedicated row even when no matching posts remain.
- Hardened ranking inputs: non-finite/negative/oversized engagement counts are normalized and bounded; future timestamps cannot earn extra recency boosts; age decay is bounded to avoid numeric underflow.
- Added device-aware initial feed batches: 3 for constrained hardware/network, 5 default, 7 for higher-core devices. The initial server/client render remains fixed at 5; device adaptation happens after hydration to avoid an SSR mismatch.
- Added opt-in eager/high-priority loading for the first visible feed image only, with responsive size hints; all other images remain lazy. Feed videos now use `preload="none"` to avoid loading metadata for every rendered card. Existing signed media URLs remain byte-for-byte unchanged; no untrusted image transformation query is appended.
- Migrated additional high-traffic title/card surfaces to shared design tokens and added a Playwright screenshot harness for seven viewport classes and both color schemes. Added an Android/Pi Browser physical-device acceptance matrix.
- Added `scripts/check-phase2-feed-controls-performance.mjs` with 29 source-contract checks and registered it in `prebuild` and `verify:static`. Added `npm run capture:phase2-responsive` for preview-only screenshot capture.
- Added Creator Studio draft continuity: existing local drafts can be opened through the canonical composer contract or deleted; local draft storage is now account-scoped. Unowned legacy v1 drafts are not imported into another account and remain on device. Scheduled publishing is explicitly disclosed as unavailable rather than simulated. Added a 12-check Creator Studio draft gate.

**Verification:** Phase II Creator Studio draft contract 12/12; feed controls/performance 29/29; design-system/adaptive-shell 15/15; feed safety 12/12; Pass 40 feed reconciliation 12/12; visual cohesion 9/9; Phase 5 design system 23/23; Phase 25 premium UI 10/10; messages/notifications 18/18; communities/discovery 15/15; marketplace commerce 15/15; seller experience 9/9; marketplace integrity 30/30; repository consistency 6/6. These are source-level gates.

**Device acceptance limitation:** no preview URL, authenticated test state, installed dependencies/Playwright browser or physical Android/Pi Browser device was available. No screenshot was generated and no claim of all-device compatibility is made. The runnable harness and acceptance matrix are documented in `docs/PHASE-II-DEVICE-ACCEPTANCE-MATRIX-2026-11-09.md`.

**Safety:** no financial authority, wallet/payment/reward/payout/refund/order/entitlement logic or records changed. No migration, dependency, lockfile or package version change. No push/Mainnet capability enabled. Phase II remains IN PROGRESS; production remains NOT APPROVED.


## Phase II closeout pass 4 — attachments, header migration and honest acceptance status (2026-11-09)

**Delivered (source-level, verified):**

- **Messaging attachment validation (#17).** Ownership via `gh_media_authorize_viewer` is unchanged, but the validator now also re-reads the stored `gh_media_assets` record (service-role, server-side) and treats it as authoritative. Client-declared MIME type, kind and size are discarded and replaced by the stored values. Attachments must be `ready`, not deleted, owned by the sender, in the upload pipeline's sniffed allowlist (JPEG/PNG/WebP/GIF/AVIF, MP4/WebM/MOV, PDF, common audio; SVG/HTML/archives/executables are rejected), kind-consistent with MIME, and within the shared byte caps (40 MiB video, 50 MiB image/PDF). File names are stripped of path separators, control and bidi-override characters. Pure policy lives in `lib/server/media/message-attachment-policy.ts`; 11 behavioural tests in `scripts/test-phase2-messaging-attachment-policy.mjs`. No migration was needed. **Not done:** malware/content scanning (no scanner is integrated) and delivery-state semantics.
- **Design system (#11).** Discover, Profile and Rewards titles moved to the shared `gh-type-title` token (Feed, Messages and Marketplace were already migrated). Communities and Wallet have no single title element to migrate and were left unchanged rather than forced.
- **Gate.** `scripts/check-phase2-closeout-attachments-design.mjs` (14 checks) plus the test above, registered in `prebuild`, `verify:static` and `check:phase2-closeout`.

**Deliberately NOT implemented:**

- **Scheduled publishing** stays disabled. The repository has no durable server-side scheduler, worker, retry/dead-letter handling or operator controls, and adding one requires a migration and deployed worker that cannot be rehearsed here. The gate asserts it stays disabled.
- **Remote push** stays disabled (`REMOTE_PUSH_NOT_ENABLED`); no provider credentials, sender configuration or device delivery have been tested.

**NOT RUN — requires your environment:**

- **Responsive screenshots (phone/tablet/laptop/desktop).** This workspace has no installed dependencies, no network, no preview URL and no authenticated session, so the app cannot be built or served. Run `GREENHAVEN_PREVIEW_URL=... npm run capture:phase2-responsive` against a Vercel Preview.
- **Android and Pi Browser acceptance.** Requires physical devices; follow `PHASE-II-DEVICE-ACCEPTANCE-MATRIX-2026-11-09.md`. No result is claimed.
- Node 24.15.x install/typecheck/lint/build (workspace has Node 22.23.4). The new TypeScript was exercised only through Node's type-stripping test.

**Status:** source work for Phase II is complete to the extent safely possible; Phase II acceptance is NOT complete until the screenshot and device runs pass. Production remains NOT APPROVED.
