# GreenHaven Phase 8 — Production Hardening
Date: 2026-10-15

## Scope
Final cross-phase hardening after Phases 1–7. Focus: security boundaries, reward authority, regression gates, migration presence, financial fail-closed settings, and release readiness. No new product feature was introduced.

## Fixes implemented

### 1. Reward API authority tightened
`POST /api/economy/rewards/evaluate` now rejects any request containing a client-supplied `amount` with `CLIENT_AMOUNT_FORBIDDEN`.

The reward engine no longer carries a `clientSuggestedAmount` input. Reward size is derived from the server rule catalog and durable emission governor only.

This removes an unnecessary client-credit field from the public contract rather than merely accepting and ignoring it.

### 2. Production build gates remain fail-closed
Verified `next.config.mjs` keeps:
- `typescript.ignoreBuildErrors = false`
- `eslint.ignoreDuringBuilds = false`

No build/lint bypass was introduced.

### 3. Cross-phase regression guard added
Added:
`scripts/test-phase8-production-hardening.mjs`

It verifies authentication, reward amount authority, wallet authoritative snapshot usage, financial server boundaries, production build settings, and presence of all three Phase 2–5 additive migrations.

### 4. Existing reward regression contract updated
Updated `scripts/test-reward-emission-order.mjs` to assert the stronger Phase 8 rule: client reward amounts are rejected at the API boundary and no longer exist in the reward-engine input contract.

## Verification performed

PASS — JSX safety: 613 files scanned.

PASS — Production safety scan: 21/21.

PASS — Phase 8 hardening checks: 16/16.

PASS — Economy v1.2: 173/173.

PASS — Atomic reward stage: 20/20.

PASS — Reward emission order: 15/15.

PASS — Durable Pi payment static suite: 40/40.

PASS — IDOR static suite: 124/124.

PASS — Social authorization static suite: 31/31.

## Build limitation

A full `npm run typecheck`, `npm run lint`, and `npm run build` was not completed in this runner. The extracted project did not contain installed dependencies. An `npm ci --legacy-peer-deps` attempt was started but the execution environment timed out before dependency installation completed; this was not treated as a build pass.

The repository remains configured to fail closed on TypeScript and ESLint errors, so Vercel must perform the final dependency-backed build gate.

## Runtime/operator verification still required

1. `npm ci --legacy-peer-deps`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. Apply/reconcile migrations in exact order, including the three additive Phase 2–5 migrations.
6. Test Pi Browser payment flows for VIP/VVIP monthly/yearly.
7. Test interrupted payment recovery and repeated complete/fulfill/recover calls.
8. Test concurrent wallet spend/withdrawal operations against the real Supabase database.
9. Test feed/comment cursor pagination against production-like data volume.
10. Test profile/media upload and compression with large source images.

## Final engineering decision

AUTOMATED STATIC/REGRESSION GATES PASS.

NOT YET A CLAIM OF LIVE PRODUCTION PASS until the operator/runtime gates above are executed on the testnet deployment.
