# Phase 1 — Wallet and reward settlement hardening

Baseline: GH-CONNECT 0.90.0. Scope: pending GHC claims, 48-hour maturity, authoritative wallet refresh, and client-side claim handling.

## Changes made

- Removed the Wallet's local-domain fallback when the durable pending-reward claim endpoint fails. A failed/unauthenticated/network claim can no longer be reported as a successful balance credit from local state.
- Removed the Rewards Centre's local claim fallback for the same reason; errors are shown and the user can retry.
- Added a no-store authoritative wallet synchronization after successful Rewards Centre claims and emitted the wallet refresh/sync events.
- Removed the one-shot sessionStorage gate from automatic matured-claim processing. Previously the flag was set before processing, so a transient error could prevent all further attempts in that session.
- Added an in-flight guard and a 60-second visible-tab reconciliation refresh, plus online/focus/event refreshes, to refresh wallet snapshots and retry matured holds without logout.
- Kept claim amounts, ownership, maturity and available balances server-authoritative; no optimistic balance credit was introduced.

## Validation

- `node scripts/check-jsx-safety.mjs`: PASS (772 files scanned).
- `node scripts/scan-production-safety.mjs`: PASS (21 checks, 0 failures).
- `node scripts/check-project-truth.mjs`: 3 existing version-alignment failures (README, project-truth document, verified manifest); these are not silently rewritten as part of the wallet behavior fix.
- Full TypeScript/build verification was not completed in this environment: archive pins Node.js `^24.15.0`, while the available runtime is Node.js `22.16.0`; dependency installation also timed out. Do not treat this phase as release-verified until checks run on the pinned runtime and the live testnet database migration/configuration is confirmed.

## Operator verification still required

1. Confirm migrations for the 48-hour pending lifecycle and atomic pending-claim RPC are applied to the intended testnet database.
2. Create a legitimate pending reward and verify it remains pending before `redeemable_at`.
3. After maturity, claim once and confirm the durable ledger transaction and authoritative wallet snapshot both update; repeat the same request to verify idempotency.
4. Simulate auth/network/HTTP failures and verify no client-side balance credit or success toast occurs.
5. Verify two sessions/users cannot claim another user's hold, and verify concurrent duplicate claims settle once.
