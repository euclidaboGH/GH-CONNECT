> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 06 — App shell, navigation and onboarding

**Release:** 0.150.4  
**Status:** Source improvements implemented; full journey and visual acceptance remain open.

## Improvements delivered

- Deep links now resolve through the canonical destination catalogue instead of accepting only raw primary-tab IDs. Existing aliases such as `feed`, `inbox`, `wallet`, `market`, and `compose` can route through the same destination contract.
- Primary-tab links continue to use shell state; overlay links are dispatched on the next task so the shell event listeners have time to mount. URL cleanup preserves browser history state, unrelated query parameters, and the URL hash.
- Invalid tab destinations are discarded without blocking app startup. Malformed URL parsing is isolated from the app boot path.
- The not-found page no longer silently redirects every unknown path after a delay. It explains the issue and gives explicit **Open GreenHaven** and **Go back** actions, preserving deep-link context and user control.
- Not-found recovery includes initial keyboard focus, a labelled main landmark, and visible focus styling.
- Added a dedicated Phase 6 shell/navigation contract checker and npm script.
- In v0.157.5, navigation commands return safely outside a browser runtime, runtime settings-section inputs are allowlisted, navigation strings reject control characters, and the explicit not-found back action falls back to Home when no prior history entry exists.

## System review findings / preserved contracts

- Kept the canonical five-item bottom navigation (Home, Discover, Create, Messages, Profile).
- Kept Matches and Communities available as secondary destinations through the existing canonical resolver.
- Preserved the existing server/local onboarding gate; an unknown identity state is not treated as a new account.
- Preserved the session-lock requirement that the app/provider tree remains mounted behind the lock, avoiding lost profile and onboarding state.
- No changes to auth/session APIs, identity schema, wallet/payment/reward authority, database schema, migrations, or provider configuration.

## Acceptance still required

Source checks do not establish that all journeys work in a real browser. Before calling Phase 6 fully accepted, exercise fresh and returning users, Pi sign-in callback, PIN setup/unlock/re-authentication, onboarding completion and retry, direct links to every primary/overlay destination, invalid/expired links, browser back/forward, screen reader announcements, keyboard-only navigation, offline/reconnect, and narrow-screen safe areas. Validate on supported Node 24.15.0 and run TypeScript/lint/build/browser E2E after Phases 1–12 are consolidated, as agreed.

No production database, payment, Mainnet, identity-provider, or live environment was accessed or changed.
