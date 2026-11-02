> Engineering note — 2026-11-02

# Phase 9 continuation 4: keyboard focus containment and recovery truthfulness

## Implemented

- Reworked the shared modal focus trap to re-query focusable controls at each Tab event, so conditional UI and disabled controls do not leave a stale focus order.
- Excluded disabled, hidden, inert, `aria-hidden`, and visually hidden controls from the focus sequence.
- Wrapped forward and reverse Tab navigation, contained focus when a surface has no focusable descendants, supported an explicit autofocus control, and used `preventScroll` where supported.
- Made cleanup idempotent and restored focus to the previously active connected element when the modal closes, without restoring focus into the closing surface.
- Preserved the existing unified compose lifecycle integration.
- Removed an unsupported reassurance from the 404 page that account/saved progress was unchanged. The page now gives actionable route recovery guidance without claiming an unverified state.
- Added 18 static regression assertions and registered the checker in both `prebuild` and `verify:static`.

## Safety boundaries

- No authentication, authorization, wallet, payment, economy, database, or migration behavior changed.
- Focus handling is UI-only. It does not authorize any action or alter server-side outcomes.
- Error messages continue to avoid raw exception details and show only a bounded safe correlation reference.

## Verification

- Continuation 4 checker: **18/18 passed**.
- Phase 9 base checker: **15/15 passed**.
- Continuation 3 checker: **7/7 passed**.
- Full configured `npm run verify:static`: **passed**, exit code 0.
- ZIP archive integrity test: **passed**.
- The project declares Node 24.15.0; the available runtime is Node 22.16.0. TypeScript, lint, production build, real keyboard/screen-reader tests, Pi Browser, and live Supabase integration remain unverified here.

## Remaining Phase 9 priorities

1. Browser-driven keyboard-only tests for modal open/close, focus restoration, and tab switching.
2. Route-level loading/empty/error/retry state inventory and consistent retry semantics.
3. Authorization-aware deep-link restoration and session-expiry handling.
4. Mobile safe-area and virtual-keyboard behavior on real devices.
5. Responsive phone/tablet/desktop and reduced-motion testing.
