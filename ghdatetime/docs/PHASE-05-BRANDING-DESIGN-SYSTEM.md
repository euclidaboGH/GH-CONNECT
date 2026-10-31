> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 05 — GreenHaven branding and production design system

**Release:** 0.157.4  
**Status:** Source-level design-system hardening implemented; rendered visual and accessibility acceptance remains open.

## Brand integrity (non-negotiable)

- The official GreenHaven product mark remains `public/gh-connect-logo.png`.
- The official GHC coin mark remains `public/ghc-coin-logo.png`, with the existing approved 64px and 32px derivatives retained.
- This phase does not redraw, recolor, crop, regenerate, replace, or apply a solid plate behind either mark. Asset paths are centralized through `brandAssets`; source checks pin expected SHA-256 digests so accidental replacements are caught.
- The fallback GHC glyph is an image-load fallback only; it is not an alternative product logo.
- Product name, GHC label, payment/economy semantics, and existing feature flows are unchanged.

## Improvements in this increment

- Kept `app/globals.css` as the runtime CSS-token source and expanded the TypeScript design-system exports with canonical asset paths and accessibility contracts.
- Updated the shared GreenHaven and GHC logo components to consume the centralized paths without changing their rendered asset choices or sizing behavior.
- Made page gutters respect device safe-area insets and allowed content-width containers to shrink safely in nested grid/flex layouts.
- Strengthened visible keyboard focus using the shared focus ring.
- Added `prefers-contrast: more` and Windows forced-colors behavior for status chips, skeletons, and keyboard focus.
- Preserved reduced-motion behavior; skeleton animation remains disabled when reduced motion is requested.
- Expanded the Phase 5 checker to verify official brand asset hashes, paths, component wiring, responsive safe areas, high-contrast behavior, semantic statuses, focus, touch sizing, and reduced motion.

## Usage guidance

- Use `statusClass.success`, `.warning`, `.danger`, and `.info`; do not communicate state by color alone. Include text or an accessible label.
- Use empty states only for genuine zero-result conditions and include explanatory copy and a useful next action. Use skeletons only while content is loading.
- Keep focus indicators visible. Aim for at least 44 CSS-pixel touch targets for primary interactive controls.
- Prefer semantic theme tokens over one-off status colors in new shared UI. Migrate existing screens incrementally with visual review rather than broad search-and-replace.
- Never modify the official logo assets without explicit owner approval and a separately reviewed brand-asset change.

## Verification

Run `node scripts/check-phase5-design-system.mjs`, `node scripts/check-phase5-reliability.mjs`, and `node scripts/check-release-hygiene.mjs`. These are source-contract checks only. They do not prove rendered contrast ratios, pixel consistency, or full assistive-technology compatibility.

Acceptance still requires review across light/dark themes, narrow mobile, tablet/desktop, keyboard-only navigation, screen readers, reduced-motion settings, high-contrast/forced-colors mode, and supported browsers. TypeScript, lint, and production build must run under the supported Node.js 24.15.0 runtime with dependencies installed from the lockfile.

## Safety boundaries

No logo or brand image was replaced or edited. No API, identity, database, RLS, migration, payment, reward, wallet, membership, or Pi contract was changed. No production or Testnet environment was accessed or modified.
