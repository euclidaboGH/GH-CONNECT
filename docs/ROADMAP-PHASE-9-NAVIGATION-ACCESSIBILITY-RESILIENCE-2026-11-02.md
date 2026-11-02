> Engineering note — 2026-11-02

# Phase 9: navigation, accessibility and resilience — continuation 2

## Implemented in this pass

- Hardened the shared screen-reader announcement helper: it creates the polite live region if needed, clears prior content before announcing repeated messages, bounds announcements to 240 characters, strips control characters, and coalesces rapid announcements so stale queued messages are not emitted.
- Fixed the global skip-link helper so it does not add a duplicate to the authenticated shell, and so it only links to a main-content target that actually exists. The authenticated shell's existing `#ghc-main-content` destination remains canonical.
- Expanded the Phase 9 source-contract checker from 10 to 15 assertions, covering announcement reliability and bounds, skip-link destination integrity, and reduced-motion stylesheet behavior.
- Kept the changes additive and limited to accessibility/navigation resilience.

## Safety boundaries

- No authentication, authorization, identity, database, financial, payment, or migration behavior was changed.
- Announcements are presentation-only; they do not claim a server action succeeded. Feature flows must continue to announce success only after their existing durable confirmation point.
- Error references remain sanitized and bounded; no raw exception messages or stack traces are rendered to users.

## Verification

- Phase 9 navigation/resilience checker: **15/15 passed**.
- Existing accessible-navigation checker: passed.
- Existing experience-cohesion checker: passed.
- Full configured `npm run verify:static`: **passed** (exit code 0) on Node 22.16.0.
- The repository requires Node 24.15.0. Typecheck, lint, production build, browser-based keyboard/screen-reader testing, and live Pi Browser/Supabase integration remain unverified in this runtime.

## Remaining Phase 9 priorities

1. Keyboard-only end-to-end navigation tests across the actual app shell.
2. Route-level loading/empty/error/retry state inventory and consistency checks.
3. Authorization-aware deep-link restoration and session-expiry behavior.
4. Safe-area and virtual-keyboard coverage on mobile.
5. Responsive layout checks for phone/tablet/desktop, including reduced-motion overlays.
