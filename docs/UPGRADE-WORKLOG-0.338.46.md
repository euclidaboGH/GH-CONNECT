> **LEGACY VERIFICATION FIXTURE** — retained as historical evidence; Run #283 / 0.338.47 is the current implementation worklog.

# GreenHaven 0.338.46 — Run #281 ecosystem feature implementation

**Baseline:** 0.338.45 working implementation candidate, derived from the user's 0.338.43 ecosystem source archive.  
**Target:** Testnet source candidate only.  
**Production:** NOT APPROVED. Mainnet untouched.

## Implemented

### Run #279 — Active module safety hardening
- Wallet withdrawal sheet now opens through one entry point that clears the prior account's withdrawable snapshot and Pi username before the new session. The sheet then obtains a fresh authenticated, no-store snapshot.
- Wallet consent requests only `wallet_address`; broader `username` and `payments` scopes are not requested as fallback.
- Reservation copy distinguishes server-proven no-provider-attempt release from provider-backed cancellation/settlement; the UI cannot force-release funds.
- Corrected Next.js client directive placement in Discovery Grid, Enhanced Post Card and Rewards Centre.
- Retired the obsolete non-signaling call-intent endpoint with HTTP 410 and no request-body buffering.

### Run #280 — Events prelaunch implementation
- Added a canonical server-side service release helper.
- Added authenticated, durably rate-limited Events discovery using existing community event, community, membership and RSVP records. Public communities are visible; private/invite-only events require active membership; deleted communities and ended/cancelled events are excluded.
- Event projection omits creator IDs, member rosters and unverified attendance totals; online links must be HTTPS and credential-free.
- Added an Events screen with search, category filtering, pagination, RSVP through the existing durable community platform route, and stale-request cancellation.
- Events remains `COMING_SOON`; its API returns 404 before auth/data access and the screen is not wired into the directory.

### Run #281 — Charity, Services and Creator Tools prelaunch implementation
- Added a read-only Charity & Impact API and screen using the canonical `gh_charity_user_summary` RPC. Only recorded contributions are projected; unique references and user IDs are omitted; amounts use exact BigInt atomic PI formatting. Unsafe numeric precision fails closed. No donation or payment action is added.
- Added a Services directory screen backed by the existing Marketplace `kind=service` query. It accepts only durable active service listings with supported GHC/PI currency and opens the canonical Marketplace listing detail. No fake/local listings or checkout action are used.
- Confirmed Seller Centre already has a real seller command center inside Marketplace, including active/paused/sold-out/draft/low-stock/incomplete listing and order-attention metrics.
- Added a read-only Creator Tools screen backed by the authenticated creator overview API. The creator API now uses separate durable fail-closed read/write rate limits and private no-store responses. The screen displays creator profile, post count, reputation and source health without exposing earnings amounts or initiating tips/payouts.
- Charity, Services and Creator Tools remain `COMING_SOON`; their new screens are not wired into the ecosystem directory. Existing underlying Rewards, Marketplace and Social APIs remain available for their current active uses.
- Registry runtime test confirms all 41 services across nine categories remain 11 Active / 30 Coming Soon.

## Verification
- Ecosystem registry: **41 services / 9 categories / 11 Active / 30 Coming Soon** — passed.
- Events discovery contract: **15/15**; release-boundary checks: **14/14**.
- Charity impact contract: **19/19**; release-boundary checks: **12/12**.
- Services directory contract: **12/12**; release-boundary checks: **10/10**.
- Creator Tools safety checks: **13/13**.
- JSX safety scan: **1,075 files scanned, passed**.
- TypeScript transpile/syntax parsing for the 11 touched TS/TSX modules: **11/11 passed** (syntax validation only, not semantic typecheck).
- Full `verify:static` chain: **passed**.
- Consolidated `verify-phase14-static`: **61/61 passed**.
- Prebuild check manifest: **309 checks discovered** in dry-run/list mode; not executed because Node.js 22.16.0 is below the required runtime.

## Verification scope

The checks above are source-only verification and isolated helper testing. They do not substitute for a dependency-backed Next.js build, live database execution, or browser/device acceptance. The project requires Node.js 24.15.0 or newer.

## Outstanding blockers
- Workspace Node.js is 22.16.0; the project requires Node.js 24.15.0 or newer. `node_modules` is absent and npm registry access is unavailable. Typecheck, lint and production build are not claimed.
- No local PostgreSQL, Supabase CLI, Docker or Podman is available for clean-database rehearsal.
- Live Testnet migration history contains 38 generated records. Sixteen social/call migrations still lack exact source files and must be restored and dependency-reconciled before any migration rehearsal or push. No migration was applied in this run.
- Events, Charity, Services and Creator Tools standalone screens remain unwired while their service statuses are Coming Soon. Browser/device acceptance is pending.
- Remaining standalone modules still needing category-specific schemas and end-to-end workflows: Intellectual Marketplace; GH Education, Primary, Secondary, Tertiary, Scholars Hub and Courses; Transport, Road, Rail, Air, Sea and Logistics; Hospitality, Hotels, Accommodation, Reservations and Travel; Causes, Donations and Community Projects; Entertainment and Digital Content; OpenMind AI, AI Search and Knowledge Services. Existing Marketplace seller-centre and service-listing capabilities are reused but do not change the separate Coming Soon labels. The 1,230 service/track objectives are not marked complete by this first implementation tranche.

No SQL, wallet, reward or payout data was changed. No GitHub push, Vercel deployment or Mainnet operation was performed.
