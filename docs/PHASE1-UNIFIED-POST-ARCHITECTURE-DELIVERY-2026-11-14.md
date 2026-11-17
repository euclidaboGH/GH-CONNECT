# Phase 1 — Unified Post Design Architecture

**Project baseline:** `gh-connect@0.338.67` from `GREENHAVEN-PHASE5-SETTINGS-PRIVACY-2026-11-14.zip`  
**Delivery scope:** Shared post-card finishing layer and quoted-post preview reliability.  
**Change policy:** Minimal, coordinated, non-destructive. No schema or migration changes.

## Implemented

1. Added `components/ghc/quoted-post-preview.tsx`, a shared quoted-post preview used by the canonical post card.
2. Replaced the placeholder “Original post content preview...” with a real viewer-authorized preview fetched from `GET /api/social/posts/[id]`.
3. Kept privacy enforcement on the existing server endpoint. The preview sends same-origin credentials, disables caching, validates the post ID, aborts stale requests, validates durable image URLs, and displays a neutral unavailable state when the post cannot be viewed. It does not attempt a privileged fallback.
4. Added a final, scoped post-card style layer using neutral border, restrained shadow, consistent 16px desktop radius and 14px mobile radius. Existing legacy declarations remain in place for now; the new scoped layer is authoritative for canonical `data-post-surface` cards. Removing older blocks is deferred until responsive visual comparison confirms no unrelated regressions.
5. Added `scripts/check-phase1-unified-post-architecture.mjs` and package scripts `check:phase1-unified-post-architecture` / `test:phase1-unified-post-architecture`.

## Verification performed

- Phase 1 architecture contract after retry/cancellation hardening: **14/14 passed**.
- Existing Run #266 shared social post experience contract: **14/14 passed**.
- Existing Phase 7 social experience contract: **24/24 passed**.
- `npm run typecheck -- --pretty false` was attempted, but the project precheck correctly stopped it because the available runtime was Node `v22.16.0`; the repository requires Node `^24.15.0`. Dependencies were not installed, so TypeScript, lint and production build remain unverified.

## Current status

**Phase 1 implementation scope is delivered in source; release acceptance remains blocked.** The canonical renderer, viewer-authorized quote preview, retry behavior, scoped design tokens, surface inventory and regression contract are in place. Visual/browser acceptance is still a release gate and is not marked passed.

## Explicitly not claimed

- No browser-based visual acceptance or multi-account E2E has run.
- No Supabase migration or live database change was required or applied.
- No blockchain or wallet logic was changed.
- No GitHub push or Vercel deployment was performed.
- Full production build, TypeScript and ESLint are still release gates.

## Next Phase 1 work

1. Inventory every canonical and legacy post surface, including archived/sample/board community states and saved/detail surfaces.
2. Compare responsive screenshots at phone, tablet and desktop widths before deleting historical CSS blocks.
3. Extract additional card subcomponents only where prop contracts and behavior can remain stable; avoid a broad rewrite of the 1,200-line canonical renderer.
4. Verify quote preview against public, private, deleted, archived, unavailable and slow-loading original posts in browser E2E.
5. Continue visual refinements only after the supported Node 24 build and existing regression checks pass.
