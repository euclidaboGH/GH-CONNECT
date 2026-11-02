> Engineering note — 2026-11-02

# Phase 9 — Continuation 7: Accessible Recovery Journeys

## Scope

This continuation expands Phase 9 from static UI contracts into explicit Playwright journeys for public recovery states. It covers unknown-route focus, reduced-motion preference, viewport zoom configuration, and keyboard focus at compact-phone, phone, and desktop widths. A dedicated static checker protects these contracts and is included in both `prebuild` and `verify:static`.

## Safety boundaries

- No authentication, authorization, session, wallet, Pi payment, GHC ledger, or database migration behavior is changed.
- Browser coverage uses public routes and does not fabricate Pi identities, cookies, or financial state.
- Unknown-route HTTP responses are asserted not to be 5xx; the browser test also verifies the rendered 404 recovery UI and initial focus.
- Browser tests are authored but must be executed against a configured local or Preview environment before their runtime behavior is considered verified.

## Verification

- `node scripts/check-roadmap-phase9-continuation7.mjs`: expected to validate 12 source contracts.
- `npm run verify:static`: passed with exit code 0 in the available environment (Node 22.16.0).
- Playwright execution, Node 24.15.0 build/typecheck/lint, Pi Browser, and live Supabase checks are separate gates and are not inferred from source assertions.

## Next integrated priorities

1. Execute browser journeys in a Node 24.15.0 environment with Playwright browsers installed.
2. Add session-aware deep-link tests using real, explicitly supplied non-production test identities only.
3. Audit route-specific loading/error/empty/retry states and test them without bypassing authorization.
4. Complete physical-device safe-area and virtual-keyboard checks in Pi Browser.
