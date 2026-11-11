# Phase II #11 — Shared Design System and Adaptive App Shell

**Date:** 2026-11-09  
**Baseline:** GREENHAVEN 0.338.6  
**Status:** IMPLEMENTATION PASS 1 — shared token contract and responsive shell refinement delivered; cross-device visual acceptance remains open.

## Audit findings

The baseline already had a substantial design foundation: light/dark themes, semantic status colors, button/card/surface classes, reduced-motion rules, safe-area spacing, 44px control targets, and responsive content sizing. The app shell already expanded for tablet/desktop and used a broad desktop canvas. A full redesign or replacement would duplicate existing work and create avoidable regression risk.

The audit found a concrete design-system defect: `lib/design-system.ts` exposed semantic colors as `hsl(var(--...))`, while the CSS variables are already complete hex or OKLCH values. That wrapper can produce invalid CSS for consumers of the shared color exports. Several JS design tokens also repeated hard-coded values instead of using the runtime CSS variables.

## Implemented

- Added shared spacing tokens 6–8 and connected the TypeScript spacing exports to runtime CSS variables.
- Added one semantic type scale for display/title/body/meta, including line-height tokens; the explicit `.gh-type-*` helpers now consume those tokens.
- Added shared page-gutter, shell-width, content-width, card-padding, control-radius, dialog-width and focus-outline tokens.
- Added `.gh-page-container`, `.gh-section-stack`, `.gh-card-padding` and `.gh-field` primitives for incremental migration by high-traffic surfaces.
- Kept the shell edge-to-edge on phones and normal-width tablets/desktops; bounded ultra-wide desktop workspaces at 90rem and centered them with a restrained edge/shadow treatment.
- Migrated the app's shared loading fallback to `.gh-page-container`.
- Corrected the semantic color exports to return `var(--token)` directly, rather than incorrectly wrapping complete CSS color values in `hsl()`.
- Added `scripts/check-phase2-design-system-adaptive-shell.mjs` (15 assertions), registered in `prebuild`, `verify:static` and `check:phase2-design-system`.
- Classified the current 0.330.50–0.338.6 release worklogs and Phase I acceptance runbook in `scripts/check-doc-hygiene.mjs`; expanded the active engineering-note date recognition to 2026-11-09.

## Compatibility and safety

- Existing theme presets and the six-item canonical navigation contract are unchanged.
- Logo files and brand artwork are unchanged.
- No navigation destinations, tab state, scroll ownership, auth flow, feature APIs or data contracts changed.
- No financial, wallet, reward, payment, payout, refund, order settlement or entitlement logic changed.
- No migration, dependency, package version or lockfile change was made.

## Verification

- New design-system/adaptive-shell gate: 15/15.
- Existing visual cohesion gate: 9/9.
- Existing Phase 5 design-system gate: 23/23 (including approved logo asset hashes).
- Existing Phase 25 premium UI gate: 10/10.
- Phase II feed safety gate: 12/12.
- Pass 40 feed reconciliation gate: 12/12.

These are source-level checks only. The workspace uses Node 22.16.0 while the project runtime contract is Node 24.15.x; no full install, TypeScript check, lint, production build, browser screenshot comparison, Android/Pi Browser device test or accessibility audit was run in this pass.

## Remaining acceptance

1. Run the shell at narrow Android, tablet, desktop and ultra-wide viewport sizes, including keyboard-only and reduced-motion checks.
2. Capture screenshots for Home/feed, Discover, Messages, Communities, Profile, Cart/Marketplace and modal overlays in light and dark themes.
3. Validate overflow, focus order, safe areas, text zoom, long localized strings and RTL at real viewport sizes.
4. Continue migration of high-traffic screen components to the new shared primitives only where a screen-specific regression test can be added.

**Phase II remains IN PROGRESS. Production remains NOT APPROVED.**
