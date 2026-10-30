# Phase 4 — PI withdrawal boundary hardening (0.182.0)

## Implemented
- The PI earnings quote endpoint uses the shared bounded streaming JSON parser with an 8 KiB limit; malformed input returns 400 and oversized input returns 413.
- Atomic-unit amounts must be positive safe integers. Decimal PI amounts must be finite and positive, and the converted atomic amount must remain a safe integer before it reaches the database quote RPC.
- Quote UI requests use `cache: no-store`, a 10-second abort timeout, cancellation of superseded requests, stale-response protection, and cleanup on unmount.
- Added `scripts/check-phase4-pi-withdrawal-boundary.mjs` to `prebuild` and `verify:static`.
- General earnings quoting remains separate from the cashback-only A2U claim route.

## Verification
- `check-phase4-pi-withdrawal-boundary.mjs`: 12/12 passed.
- `check-phase8-earnings-dashboard.mjs`: 13/13 passed.
- `check-phase2-financial-body-bounds.mjs`: 20/20 passed.

## Explicitly not claimed
This is boundary hardening, not completion of the actual payout execution lifecycle. No general earnings PI payment is submitted by this change. Before enabling payout execution, Phase 4 must establish an idempotent payout request/reservation, a dedicated execution path bound to the linked Pi identity, verified provider receipt evidence, atomic settlement/release, ambiguous-outcome recovery, and an operator-controlled Testnet gate. Cashback-only A2U must not be repurposed for general earnings. Mainnet remains disabled. No live database mutation or Testnet payout was performed.

## Runtime limitation
The available local runtime is Node 22.16.0 while `.nvmrc` requires Node 24.15.0. TypeScript, lint, and Next.js production build must be run under supported Node 24 before release.
