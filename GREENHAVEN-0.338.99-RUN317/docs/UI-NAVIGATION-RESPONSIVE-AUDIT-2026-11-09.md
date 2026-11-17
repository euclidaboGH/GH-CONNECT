# UI, Navigation & Responsive Experience Audit — 2026-11-09

**Release:** 0.338.9  
**Baseline:** GREENHAVEN 0.338.8 Independent Audit  
**Scope:** Shared shell, headers, Marketplace, Communities, keyboard shortcuts, active-tab scroll reset, safe areas and responsive content rhythm.

## Findings and implemented improvements

1. Expanded and compact headers had excess vertical chrome relative to their content. The shared header now uses a 36px minimum control rhythm, lighter borders and restrained blur/transitions.
2. The compact header repeated the screen subtitle while duplicating the expanded header's actions. It now omits redundant subtitle text.
3. Compact header actions could remain keyboard-focusable while visually hidden. The compact layer is now inert unless active.
4. The expanded header could also retain focusable controls after collapsing to zero height. It now yields completely to the compact bar at the threshold and is inert throughout that state, so both header variants are never simultaneously focusable.
5. Marketplace browse/detail headers used independent styling and dense vertical rhythm. They now share compact title, action and toolbar sizing.
6. Marketplace content gutters and safe-area-aware bottom clearance were too tight on larger viewports and gesture-navigation devices. Responsive spacing is increased without changing currency, filtering, checkout or order contracts.
7. Community directory content had a narrow inner column and limited outer breathing room. The scroll root now uses responsive gutters and section rhythm while preserving its bounded reading column and touch scrolling.
8. Active-tab scroll reset relied on inline `pointer-events` style string matching. It now uses stable `data-gh-tab-panel` identity and computed overflow/scroll dimensions to locate the active scroll owner.
9. Global keyboard shortcuts previously ignored inputs and textareas but not all editable controls, modal contexts, IME composition, repeat events or default-prevented events. These are now excluded.
10. Slash search focus now uses `preventScroll` to avoid accidental layout jumps.
11. Bottom navigation touch targets and horizontal safe-area gutters are explicitly protected at narrow widths.

## Additional whole-codebase audit repairs

The consolidated static suite exposed stale release-pinned checks and a social follow target sanitizer that coerced non-string JSON values into strings. The sanitizer now accepts only actual strings before trimming/bounds checks. Executable gates were reconciled with the already-implemented durable Marketplace order limiter, the current two-year HSTS policy, boolean/numeric non-secret environment placeholders and current release metadata.

## Independent verification coverage

The complete network/database-independent `npm run verify:static` suite passes **57/57** checks. The new automated gate has **31/31** source assertions across header sizing/focus/inertness, Marketplace layout/filter safety, Community scroll/content layout, six tab-panel identities, computed scroll-owner selection, shortcut exclusions, active navigation semantics, safe-area handling and build-gate registration.

The prior independent API/security audit remains **42/42** source controls: 22 Marketplace and 20 Community. These counts describe reviewed controls, not 42 newly discovered defects. The financial service regression gates from 0.338.8 were rerun as part of this pass; no new payment, ledger, payout, inventory or migration behavior was introduced.

## Verification limits

`npm run typecheck` was attempted. It is **BLOCKED**, not passed, because the environment provides Node `v22.16.0`, while the repository requires `^24.15.0`; `pretypecheck` correctly refuses the unsupported runtime. The previous dependency install timed out and this extracted source archive intentionally contains no `node_modules`. Browser/device screenshot validation and live provider/database acceptance cannot be claimed from static source checks.

## Release boundary

No SQL migration was added or applied. No Pi/GHC balance, reservation, order, inventory, payout, refund or provider state was changed. Existing financial authority boundaries remain unchanged. Production remains **NOT APPROVED** until Node 24.15.0 dependency-backed typecheck/lint/build, browser/device accessibility and responsive acceptance, PostgreSQL migration/RLS validation, and Pi/GHC Testnet concurrency/idempotency checks are completed.
