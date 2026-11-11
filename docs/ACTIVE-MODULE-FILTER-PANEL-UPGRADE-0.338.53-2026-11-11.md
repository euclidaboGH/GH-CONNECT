# GreenHaven Active-module filter workspace upgrade

**Source baseline:** `GREENHAVEN-0.338.53-RUN291-RELEASE-REGISTER-VERSION-REPAIR.zip`  
**Release:** `0.338.53`  
**Scope in this tranche:** all 11 Active modules — Community, GH Chat, Connections, Matches, Marketplace, Orders, Wallet, GHC, Pi Payments, Rewards and Membership.

## What changed

- Added `FilterPanel`, a shared responsive filter workspace with consistent title/description hierarchy, live result counts, active-filter count, accessible disclosure state, and a compact narrow-screen collapse control. Desktop filter controls remain visible even when the mobile disclosure is collapsed.
- Community now presents its existing search, My/Discover tabs, topic/access facets, sort and active-filter summary inside the shared workspace.
- GH Chat's active inbox now groups its existing All/DMs/Unread/Requests/Communities/Archived filters and removable summary in the shared workspace. The deprecated, non-shell `ChatScreen` was intentionally not modified.
- Connections request inbox now supports tokenized search across candidate name, request note and intent, plus a shared direction/search filter summary. Blocked-member exclusion remains applied before display.
- Matches now groups its existing match tabs and intention facets in the shared workspace, with a removable active-intention chip. Mutual-interest and block rules are unchanged.
- Marketplace browse facets are presented in the shared workspace. Orders buyer/seller role filtering is also presented in the shared workspace with a removable role chip.
- Wallet/GHC activity filters are grouped in the shared workspace. GHC transaction filters remain scoped to the GHC ledger.
- Pi Payments now has its own read-only status, date and reference-search facets; it no longer inherits GHC-only direction filters.
- Rewards history wraps its existing server-side query/status/date filters in the shared workspace. Pagination resets and server-authoritative ledger queries remain unchanged.
- Membership plan discovery now filters the Free/VIP/VVIP comparison cards by tier and searchable benefit names. This is presentation-only; current entitlements and purchase eligibility remain server-authoritative.
- Marketplace currency safety is unchanged: GHC and Pi price ranges are never compared on a common numeric scale; server filtering remains authoritative before pagination.

## Safety and scope

- No SQL migrations, RPCs, RLS policies, payment execution, settlement, reconciliation, GHC ledger, Pi authority, withdrawal, reward, membership entitlement, or release-gate logic was changed.
- Filters are read-only presentation refinements. They do not authorize or mutate social or financial state.
- No Coming Soon registry entries, routes, or release statuses were changed.
- All 11 Active services in the requested sequence now have a shared responsive filter workspace or shared-filter integration. The 30 Coming Soon services remain untouched.

## Verification completed

- Shared filter panel source contracts: **14/14**.
- Phase 10 filtering source contracts: **17/17**.
- Phase 10.2 filter integration contracts: **34/34**.
- Phase 10 filtering utility tests: **14/14**.
- Phase 10.2 filter contract tests: **28/28**.
- Priority 7 Community transformation: **13/13**.
- Priority 8 Messaging transformation: **49/49**.
- Phase 7 social experience: **24/24**.
- Phase 9 Marketplace transformation: **20/20**.
- Phase 9 Marketplace runtime contracts: **16/16**.
- Run 283 active-module wiring: **16/16**.
- Vercel build-prep regression tests: **4/4**.
- Vercel build hygiene: **17/17**.
- TypeScript TSX transpilation/syntax: **9/9 changed TSX files**.

## Not yet verified

- Full Next.js production build, full project typecheck, and ESLint were not run because this workspace only has Node `22.16.0`, while the project declares Node `^24.15.0`, and project dependencies are not installed.
- Narrow Android WebView/Pi Browser and desktop visual acceptance were not run in a real browser. Responsive source contracts pass, but they are not a substitute for device screenshots and interaction testing.
- No GitHub push, Vercel deployment, database migration, or live financial transaction was performed.

## Vercel log diagnosis and repair

The Vercel deployment was inspected directly. The failing build is commit `729f20a0908a2fdf5c29a27a13ad3a9330d268e0`; its prebuild stopped at **137/316** in `scripts/check-phase1-12-engagement-reliability.mjs` with **15/16** assertions passing. The failing assertion was `single read waits for both social and unified writes before refresh notification`.

The production notification implementation had already been refactored to collect the applicable durable writes in a `requests` array and await `Promise.all(requests)` before dispatching `ghc:notifications-read`. The checker still required an inline `Promise.all([ ... ])` literal. This is a stale static contract, not a demonstrated notification runtime failure. A separate, apply-ready patch is supplied as `GH-CONNECT-VERCEL-PREBUILD-ENGAGEMENT-CHECK-FIX.patch`; it updates only that assertion to validate the current request-array implementation. It passed the complete 16/16 engagement reliability contract against the available source baseline. It must be applied to the current GitHub branch at the failed deployment commit; the `0.338.53` RUN291 archive does not contain this newer check file.

The available RUN291 archive initially had **314** prebuild checks; this filter integration adds one new contract, bringing that archive to **315**. The failed Vercel branch has **316**, confirming that it is a different source snapshot. `prepare-vercel-build.mjs` and its 4 regression tests pass; the Vercel build stopped in the prebuild test suite before `next build` ran.

The npm deprecations are separate from the build blocker and were not force-changed in this patch:

- `isomorphic-dompurify@3.20.0` is directly declared and deprecated. Its 4.x line corrects the semver-major Node floor change; `4.7.0` is current and its documented Node range includes `^24.15.0`. However, the package also documents an `ERR_REQUIRE_ESM` risk in some CommonJS/Next.js server builds caused by jsdom; test the upgrade and its jsdom resolution on the real Next/Vercel build before merging. The manifest/lockfile were not changed without Node 24.15.0 and a successful production build.
- `pi-backend@0.1.3` is the official Pi Network server SDK and was last published four years ago. Its dependency tree brings in `js-xdr@1.3.0`, `stellar-base@8.2.2` and `stellar-sdk@10.4.1`. The Stellar packages have moved to `@stellar/stellar-sdk`; the current SDK is v17.4.0, but its migration changes include removal of the default export and folding the base package into the SDK. These were not force-overridden because this dependency sits on the Pi A2U payment path; the safe fix is a controlled Pi adapter/fork migration with Testnet E2E before any release gate changes.
- `eslint@9.39.5` is now EOL (2026-08-06); ESLint 10 is the current release line. This project uses Next 15.5.26 and its matching `eslint-config-next@15.5.26`, so the safe warning cleanup is a coordinated Next 16 / `eslint-config-next` 16 / ESLint 10 and plugin migration, followed by full lint and build verification—not an isolated ESLint version bump.
