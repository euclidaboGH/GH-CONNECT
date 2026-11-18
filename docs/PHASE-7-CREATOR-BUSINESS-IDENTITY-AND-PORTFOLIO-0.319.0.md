# Phase 7 — Creator, Business Identity and Portfolio Upgrade

**Release:** 0.319.0  
**Status:** Implementation increment complete; supported-runtime and browser acceptance pending.

## Product improvements

- Added a responsive professional/business identity showcase and editor to the owner profile, plus a read-only public peer profile presentation.
- Supports public business name/category/about/location/hours, professional title/about, service chips, skills, selected work and concise experience history.
- Client-editable professional/business payloads cannot set verification flags; server sanitization drops them. The showcase does not display self-asserted verification.
- Portfolio links and preview media are limited to HTTPS URLs; embedded credentials and non-HTTPS schemes are rejected. Links open with `noopener noreferrer` and no referrer.
- Added an account-scoped achievements showcase hydrated from the authenticated `/api/profile/achievements` endpoint. Results are deduplicated, sorted by server unlock time and cleared on identity change. No client-side unlock path was added.
- Discovery relevance now considers public professional interests alongside ordinary interests. Existing explainable reasons and ranking boundaries remain in place.
- Added source-level regression coverage and a runtime sanitizer and public-profile privacy tests (16 assertions each), wired into `prebuild` and `verify:static`.

## Security and financial boundaries

- No financial values or wallet/ledger data are rendered by the public identity showcase.
- No GHC, Pi, payment, payout, checkout, settlement or membership authority was changed.
- No database migration was added or applied.
- Verification remains server-authoritative; achievement unlock remains server-only.

## Remaining acceptance

- Node 24.15.0 `npm ci`, typecheck, lint, full prebuild and production build.
- Browser review at narrow Android, tablet and desktop widths.
- Keyboard, screen-reader, reduced-motion, dark-mode, high-contrast and RTL checks.
- Confirm real public-profile adapters include professional/business fields only when the profile visibility policy allows them.
- Performance measurements with representative profile, achievement and discovery datasets.
