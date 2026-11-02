# Phase 1 — Pi identity and authorization reconnect

Date: 2026-11-01
Baseline: GH-CONNECT 0.274.3 wallet refresh stability hotfix (Phase 4 marketplace/cart baseline retained).

## Scope delivered

- Added a wallet-native **Connect / verify Pi identity** and **Reconnect / verify Pi account** action to the unified Pi earnings panel.
- Uses the official Pi authentication runtime (`piAuthenticateOfficial`) and posts only the access token to `/api/auth/pi`.
- Relies on the server bridge to verify the token through Pi `/v2/me`, resolve the canonical GreenHaven identity, and issue the HttpOnly GH session. No client-provided UID or recipient is used to link identity.
- Refreshes authoritative earnings and wallet snapshots after the server bridge succeeds.
- Surfaces failures and explains that verified identity, payout consent, and eligibility are separate requirements.
- Added `scripts/check-phase1-pi-identity-reconnect.mjs` to `prebuild` and `verify:static`.

## Phase 1.1 results-oriented hardening

- Queued a single follow-up dashboard refresh when auth or wallet events occur during an active refresh, so the post-auth state is not silently stale.
- The client now requires explicit server verification flags before showing identity verification success.
- Non-durable identity/session status is disclosed in non-production rather than being implied to be payout-ready.
- Detailed change log: `docs/PHASE-1.1-PI-IDENTITY-RESULTS-HARDENING-2026-11-01.md`.

## Verification completed

- `node scripts/check-phase1-pi-identity-reconnect.mjs`: 13/13
- `node scripts/check-phase8-earnings-dashboard.mjs`: 13/13
- `node scripts/check-phase2-wallet-authorization.mjs`: 13/13
- `node scripts/check-wallet-refresh-stability.mjs`: 10/10
- `node scripts/check-jsx-safety.mjs`: passed, 936 files scanned

## Important boundary

This is a source-level Phase 1 deliverable. No Pi account was authenticated from this build environment, no Supabase data was changed, no migration was applied, and no payment was attempted. It does not bypass the authorization guard or turn on payout execution. A verified Pi identity does not itself authorize A2U payments.

## Remaining phases

- Phase 2: replace the wallet-card's misleading duplicate action path with a single withdrawal journey; make Eligibility open a useful module; make Linked Pi Identity open a real connection/status module; preserve Pi transaction history.
- Phase 3: end-to-end Testnet proof for eligibility, identity mapping, active payout authorization, recipient matching, feature flags, idempotency, ledger reservation, execution receipts, and recovery.

Production deployment remains blocked until Node 24.15.0 install/typecheck/lint/build and the actual Pi Browser + disposable/Testnet verification gates pass.
