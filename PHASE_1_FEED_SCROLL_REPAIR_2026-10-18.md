# GreenHaven Phase 1 — Feed and Action-Sheet Stabilization

Date: 2026-10-18
Scope: narrow, evidence-based source changes in the supplied repository.

## Implemented

1. Removed the separate comment/share total row from `components/ghc/enhanced-post-card.tsx`. The totals remain alongside their respective primary actions, avoiding duplicate-looking controls/counts. Reaction-count chips are shown only when reactions exist.
2. Updated `components/ghc/action-sheet.tsx` so scroll events originating inside the active sheet do not close the sheet. This allows the sheet's own overflow region to scroll naturally on touch devices; scrolls outside the sheet still close it after the existing arming delay.
3. Added `scripts/test-action-sheet-scroll.mjs` and wired it into `ci:verify`.
4. Updated feed layout regression checks to guard against duplicate comment/share totals.

## Checks run in this workspace

- `node scripts/test-feed-card-layout.mjs`: 9/9 passed.
- `node scripts/test-action-sheet-scroll.mjs`: 3/3 passed.
- `node scripts/test-notification-attention.mjs`: 17/17 passed.
- `node scripts/test-vercel-build-repair.mjs`: 9/9 passed.
- `node scripts/test-10-phase-baseline.mjs`: 8/8 passed.

These are source/static regression checks, not a complete TypeScript check, production build, browser automation run, or live Testnet verification.

## Confirmed notification limitation

The current app-release notice in `components/ghc/app.tsx` compares `APP_RELEASE_VERSION` with a per-user value in browser `localStorage` and adds a client-side notification. On first visit to a device it establishes a baseline without showing a notice. This is not a durable server-side broadcast to all registered users and does not prove delivery across devices. A robust existing-user announcement requires a server-owned release/announcement record, recipient eligibility policy, idempotent fan-out or inbox query, per-user read state, retry/monitoring, and a reviewed migration/API path. Do not claim all existing users were notified based on the local-storage behavior.

## Still not verified / next work

- Full `npm ci`, `npm run typecheck`, lint and production build; prior workspace reported incomplete type-definition packages.
- Browser-based scrolling tests on Android/Pi Browser and iOS; scroll changes must be validated on devices and with long content.
- Durable system announcement implementation and delivery reconciliation.
- Broader feed interaction audit, notification service failure states, and security/release gates.
- Live Supabase migrations, Vercel deployment, and Pi Testnet flows.

## Phase plan

- Phase 1: stabilize build and remove verified duplicate/scroll defects; document security and notification gaps.
- Phase 2: implement durable system announcements and unify feed interaction/notification UX with integration tests.
- Phase 3: performance, accessibility, device/browser regression, security triage, and release gates.

No remote commit, push, deployment, Supabase migration, Pi transaction, or Mainnet action was performed.
