# Pass 48 — Accessible navigation and interaction integrity

**Source version:** `0.265.0`  
**Date:** 2026-11-01  
**Status:** Source changes implemented; production acceptance remains pending.

## Scope

This pass continues from Pass47 and improves application-wide navigation semantics without changing feature behavior, domain state, API contracts, payments, identity, storage, or database schema. No Cloudflare/R2 work was performed.

## Improvements

- All six primary-tab panels are now `inert` as well as visually hidden and marked `aria-hidden` when inactive. Their links, buttons, form controls, and other descendants can no longer receive keyboard focus while another tab is active. Five of the six panels previously lacked these semantic hiding attributes.
- The bottom navigation becomes `inert` whenever it is auto-hidden or suppressed by the create hub. This closes a keyboard-accessibility gap where an opacity/height-hidden navigation could otherwise retain focusable descendants.
- Existing active-tab `aria-current` semantics and tab-switch behavior are preserved.
- Added a regression checker covering all six primary panels and hidden navigation; wired it into `prebuild` and `verify:static`.

## Verification

The Pass48 regression checker validates all six primary panels and the hidden navigation contract. The consolidated static suite, project truth, release hygiene, dependency-lock integrity, migration inventory, and archive integrity are checked separately.

## Not claimed

- No live screen-reader, keyboard browser, mobile-device, or browser E2E run is claimed.
- No TypeScript/ESLint/Next.js production build is claimed until the supported Node 24.15.0 runtime and dependencies are available.
- No migration or production deployment is required or claimed.
