# GH-CONNECT 0.69.3 — React Hook CI repair report

## Source baseline
This patch is based on the latest GH-CONNECT 0.69.3 archive previously supplied in this conversation: `GH-CONNECT-0.69.3-CI-TYPESCRIPT-WARNINGS-FIX-2026-10-22.zip`. It is not a fresh checkout of GitHub commit `bc17abc` and must be reconciled with any branch changes made after that archive.

## Changes
- Updated the connection-inbox hydration effect dependencies to react to profile display-name and photo changes.
- Refactored persistence effect state-slice capture into named render-scope aliases so the effect depends on the exact values it persists, rather than capturing the entire state object.
- Added `domains.identity` and `state.isOnline` to the profile-update callback dependencies.
- Removed unused `addToast` from the local-profile switch callback dependencies.
- Added `domains.posts` and `state.isOnline` to post creation dependencies.
- Added `domains.posts` to post deletion dependencies while retaining the state slice read by that callback.
- Removed unnecessary `state.posts` and `state.profile` dependencies from post editing.
- Added `domains.posts` and removed unused state dependencies from comment edit/delete/reaction callbacks that use functional state updates.

## Verification
- `node scripts/check-jsx-safety.mjs`: PASS (727 files scanned).
- `node scripts/check-node-runtime.mjs`: NOT PASS in this environment; local Node is v22.16.0, while the project requires `^22.22.2 || ^24.15.0`.
- `npm ci --legacy-peer-deps --ignore-scripts`: NOT VERIFIED; installation did not complete within the available execution window.
- ESLint, TypeScript, tests, and full Next.js production build: NOT VERIFIED because dependencies could not be installed under the available runtime.
- npm audit: NOT VERIFIED; no fresh audit report was generated.

No dependency versions, application features, API contracts, database migrations, or payment logic were changed. This report does not claim that the full CI run is fixed until the supported-runtime checks pass.
