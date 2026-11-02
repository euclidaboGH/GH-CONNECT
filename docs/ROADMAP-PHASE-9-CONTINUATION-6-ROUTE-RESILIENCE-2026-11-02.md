> Engineering note — 2026-11-02

# Phase 9 — Continuation 6: route recovery and browser resilience

## Scope

This continuation adds a browser-level resilience suite and a source-contract inventory around the seven App Router page routes present in this source archive. It complements the existing Phase 9 focus management, reduced-motion behavior, safe-area handling, offline status, and error-boundary work.

## Route inventory

| Route | Route-local loading boundary | Route-local error boundary | Root fallback |
|---|---|---|---|
| `/` | Uses root `app/loading.tsx` when applicable | Uses `app/error.tsx` and `app/global-error.tsx` | Yes |
| `/admin/treasury` | Uses root `app/loading.tsx` when applicable | Uses root error boundaries | Yes |
| `/portal-setup` | Uses root `app/loading.tsx` when applicable | Uses root error boundaries | Yes |
| `/privacy` | Uses root `app/loading.tsx` when applicable | Uses root error boundaries | Yes |
| `/signin/callback` | Uses root `app/loading.tsx` when applicable | Uses root error boundaries | Yes |
| `/support` | Uses root `app/loading.tsx` when applicable | Uses root error boundaries | Yes |
| `/terms` | Uses root `app/loading.tsx` when applicable | Uses root error boundaries | Yes |

This inventory describes the source tree, not a claim that every route's runtime behavior has been exercised. Route-local boundaries remain a future consideration where a route needs a distinct recovery experience; shared root boundaries are retained as the baseline.

## Browser checks added

`e2e/phase9-navigation-resilience.spec.ts` covers:

- Offline banner appears after simulated connection loss.
- Connection restoration is announced without reloading the route.
- Public `/terms` route document width at 320, 430, 768 and 1440 CSS pixels.
- An unknown route does not return a server error.

The browser tests are added to the existing Playwright suite, but are not reported as executed in this environment. They require a configured E2E base URL and running app.

## Static verification

`node scripts/check-roadmap-phase9-continuation6.mjs` checks the route inventory and resilience contracts. It is registered in `prebuild` and `verify:static`.

No authentication, session, authorization, payment, wallet, ledger, or database migration behavior was changed. No protected route restoration or authorization decision is bypassed.

## Remaining validation

- Run Playwright on Node 24.15.0 against a configured local build or staging deployment.
- Manually test keyboard and screen-reader behavior in Pi Browser on Android.
- Test tablet/desktop breakpoints and virtual keyboard behavior on physical devices.
- Add route-specific loading/error boundaries only where testing demonstrates a meaningful recovery gap.
