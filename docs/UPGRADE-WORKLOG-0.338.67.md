# Run #304 — responsive filters, search density and release-hygiene repair

**Release candidate:** `0.338.67`  
**Base:** Run #303 / `0.338.66`, retaining the Run #302 Pi withdrawal hardening.  
**Scope:** UI geometry and behaviour across Discovery, Messages, Connections, Communities, Marketplace, Orders, Membership, Rewards, Wallet/GHC and Pi Payments; CI/release hygiene.

## Twenty targeted upgrades

1. Reduced the shared filter shell's mobile padding and corner radius to reclaim vertical space without removing its visual boundary.
2. Reduced filter header typography and icon footprint for a more balanced compact hierarchy.
3. Hid non-essential filter descriptions on narrow screens while retaining them on larger screens.
4. Kept the filter disclosure available on all breakpoints and preserved explicit user control over open/closed state.
5. Added a mobile filter-tray maximum height of 52dvh/22rem.
6. Added a desktop filter-tray maximum height of 58dvh/26rem.
7. Made expanded filter trays independently scrollable with overscroll containment so long facets cannot dominate the page.
8. Preserved native hidden-state layout removal while closed.
9. Added stable data selectors for rendered responsive filter acceptance.
10. Kept connection-request search visible outside the collapsible facets; this closes a concrete regression where search was hidden with the tray.
11. Preserved incoming/outgoing request tabs and active-filter summaries inside the expandable facet area.
12. Added a real persistent Discovery/Matches search for member name, location, profession, bio and interests, with query-aware results/empty state and removable active-search summary.
13. Standardized Discovery search input and filter-action heights to 40px mobile / 44px larger screens, with 32px clear controls.
14. Raised Community and Share-sheet search fields to a 40px minimum target, retained 44px Ecosystem/Settings search, and enlarged Messaging/Community clear affordances to 32px.
15. Converted Discovery suggestions from in-flow content to an anchored overlay, preventing focus from pushing the result list down.
16. Bounded Discovery suggestion overlay height, retained independent scrolling, added pointer-safe selection and Escape dismissal.
17. Preserved global-search modal viewport bounds and contained result scrolling.
18. Added authenticated responsive e2e checks for closed-state height, persistent search visibility, expanded tray bounds, facet interaction stability and explicit close behaviour across 320, 360, 390, 768, 1024 and 1440px viewports.
19. Restored a safe `.env.example` template with public and server-only settings clearly separated, private credentials blank, and sensitive issuance/payout flags explicitly defaulted off.
20. Strengthened release hygiene to reject populated private credentials in `.env.example`, and registered the Run #304 source gate in static and prebuild verification.

## UI acceptance contract

- Search remains available while secondary facets are closed wherever a search field is part of that surface.
- Expanding a filter tray is explicit; changing a facet must not automatically close the tray.
- Long filter lists scroll inside their own bounded tray rather than taking over the entire screen.
- The filter tray has the same interaction model on mobile and desktop.
- The authenticated Playwright visual review now exercises actual open/closed behaviour and measures expanded tray height. It requires a real QA session and does not fabricate identity or financial records.

## Release hygiene fix

The supplied CI failure was caused by the source tree missing `.env.example`, while the release hygiene gate explicitly requires it. The template is now present, contains no populated private credential values, and does not expose server secrets through `NEXT_PUBLIC_*`. `.env.local` remains ignored; `.env.example` is intentionally allowed by `.gitignore`.

## Safety and verification boundaries

No dependency version, SQL migration, database record, wallet balance, reservation, payment, payout, provider state, authorization policy or entitlement was changed. No GitHub write, Vercel deployment or Mainnet action is claimed. Run #302's server-verified Pi wallet-address checks remain intact.

This remains a source-only verification scope; no live deployment or device acceptance is claimed. Run `node scripts/check-release-hygiene.mjs` (17/17), `node scripts/check-active-module-filter-panels.mjs` (14/14), `node scripts/check-run303-filter-search-density.mjs` (25/25) and `node scripts/check-run304-filter-search-release.mjs` (30/30) on the candidate. The complete `npm run verify:static` suite passes 63/63; prebuild dry-run discovers 325 checks. Full Node 24.15.0 typecheck/lint/production build and authenticated Android/Pi Browser visual acceptance remain required before release approval.
