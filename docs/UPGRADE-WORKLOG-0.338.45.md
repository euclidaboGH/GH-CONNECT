# GreenHaven 0.338.45 — Run #280 ecosystem feature implementation

**Baseline:** 0.338.44 working implementation candidate, derived from the user's 0.338.43 ecosystem source archive.  
**Target:** Testnet source candidate only.  
**Production:** NOT APPROVED. Mainnet untouched.

## Implemented

### Run #279 — Active module safety hardening
- Wallet withdrawal sheet now opens through one entry point that clears the prior account's withdrawable snapshot and Pi username before the new session. The sheet then obtains a fresh authenticated, no-store snapshot.
- Wallet consent now requests only `wallet_address`; broader `username` and `payments` scopes are not requested as fallback.
- Reservation copy explains the strict provider evidence boundary: immediate release only when the server confirms no provider ID, txid, execution start, lease or attempt; once a provider ID exists, only authoritative cancellation with no transaction or verified settlement can resolve it.
- Three client component directives were moved to the first statement.
- The legacy non-signaling call-intent endpoint was retired with HTTP 410 and no request-body buffering.

### Run #280 — Events prelaunch implementation
- Added a server-side ecosystem service access helper. New service APIs must consult the canonical service registry before reading user data.
- Added a prepared Events discovery GET API using existing canonical community event, community, membership and RSVP records. No database schema changes are required for this slice.
- The API derives the viewer from the authenticated session, applies a durable fail-closed read throttle, bounds query parameters, and performs server-side privacy filtering. Public community events are visible; private and invite-only events require active membership; deleted communities and ended/cancelled events are excluded.
- Projection omits creator IDs, member rosters and unverified attendance counts. Online meeting links are HTTPS-only and credential-free.
- RSVP uses the existing authenticated community platform route and its canonical `gh_community_event_rsvp` RPC; no client-side attendance state is treated as durable before server confirmation.
- Added an Events discovery screen with search, category filter, pagination, RSVP, online links, accessible states and retry handling.
- **Release boundary preserved:** Events remains `COMING_SOON` with destination `none`. The server API checks this status before auth/data access and returns 404; the prepared screen is not wired into the ecosystem directory. It is source implementation, not an enabled service.

## Verification
- Events discovery contract: **14/14**.
- Events release-boundary checks: **14/14**.
- JSX safety scan: **1,069 files scanned, passed**.
- Full `verify:static` chain: **passed**.
- Consolidated `verify-phase14-static`: **58/58 passed**.
- Prebuild check manifest: **304 checks discovered** in dry-run/list mode; not executed because Node.js 22.16.0 is below the required runtime.
- Wallet consent, release-reserved, communications and ecosystem coverage checks were passing on 0.338.44; package metadata is now synchronized at 0.338.45.

## Verification scope

The current checks are source-only verification and isolated helper testing. They do not substitute for a dependency-backed Next.js build, live database execution, or browser/device acceptance. The project requires Node.js 24.15.0 or newer.

## Outstanding blockers
- The environment is Node.js 22.16.0 and has no `node_modules`; the registry is unreachable from this workspace. The project requires Node.js 24.15.0 or newer. Do not claim typecheck, lint or production build until a supported runtime and dependencies are available.
- No local PostgreSQL, Supabase CLI, Docker or Podman is available for clean-database rehearsal.
- Live Testnet migration history contains 38 generated records. Sixteen social/call migrations still lack exact source files and must be restored and dependency-reconciled before any migration rehearsal or push. No migration was applied in this run.
- Events API is intentionally inaccessible while its service status is Coming Soon. Browser/device acceptance is pending; do not enable it by changing only the UI.
- The other Coming Soon modules still need their category-specific domain models, database contracts where needed, API routes, UI, security and acceptance tests. The 1,230 upgrade objectives are not being marked complete by this first service slice.

No SQL, wallet, reward or payout data was changed. No GitHub push, Vercel deployment or Mainnet operation was performed.
