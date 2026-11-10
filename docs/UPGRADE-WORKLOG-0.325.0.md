# Upgrade Worklog — 0.325.0

## Phase 9: Membership session integrity

### Source changes
- Added abortable, eight-second-bounded membership status hydration with latest-request sequence fencing.
- Abort superseded requests and outstanding requests on component unmount.
- Clear prior account membership presentation immediately on wallet authentication changes; rehydrate only after an active session signal.
- Revalidate authoritative membership after session resume and when a hidden app becomes visible.
- Strictly validate server-returned user identity, tier, boolean active state and paid expiry. Removed the shared `current-user` identity fallback.
- Failed, malformed and timed-out reads clear stale paid presentation and remain unavailable; they do not silently preserve a previous VIP/VVIP status.

### Financial boundaries preserved
- Server membership status remains authoritative and no-store.
- Server catalog pricing and existing GHC/Pi payment flows are unchanged.
- No client-side entitlement grant, payment completion, renewal, ledger credit, transfer or settlement authority was added.
- No SQL migration was added, modified or applied.

### Verification run
- `node scripts/check-phase9-membership-session-safety.mjs`: 15/15 passed.
- `node scripts/check-phase9-membership-foundation.mjs`: 18/18 passed.
- `node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/test-phase9-membership-row-parser.mjs`: 14/14 passed.
- `npm run verify:static`: initial run exposed stale current-release references in the verified manifest and consolidated release reports, plus a missing 0.325.0 worklog required by an existing gate. These documentation/manifest alignment issues are being corrected; the failed run is not reported as a pass.

### Acceptance still required
- Project Node 24.15.x typecheck, ESLint and Next.js production build with dependencies installed.
- Browser/device testing for wallet account switching, sign-out/sign-in, offline/online and background/resume flows.
- Independent operator acceptance. No live payment, database migration or production mutation was performed.

The available audit container uses Node.js 22.16.0; this project requires Node.js 24.15.0. Full typecheck, lint and production build remain unverified until run under Node.js 24.15.0 with dependencies installed. The checks above are source-level contracts and isolated helper tests only.
