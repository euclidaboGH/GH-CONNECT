# GHC Rewards Reliability Upgrade — 2026-10-18

## Root causes addressed

1. The Home daily reward card updated its countdown every second, but its claim eligibility was memoized separately and did not refresh when the Africa/Lagos reward day changed. A tab left open across midnight could therefore keep showing yesterday's state.
2. Failed daily claims could be marked as claimed in local UI state, hiding a reward even when the server did not confirm a ledger credit.
3. The Home daily claim client attempted to fall back from the canonical atomic daily endpoint to generic reward evaluation/claim routes. Daily streak claims must use the atomic daily endpoint only.
4. The daily claim route documented idempotent repeat behavior but returned a 409 before the atomic RPC for a repeat claim. Repeated claims now return an idempotent success with zero new amount, without creating another credit.
5. Backend-unavailable errors from daily claim computation were mapped to 400; they now map to 503.

## Implementation

- Added authenticated, read-only `GET /api/economy/rewards/daily` backed by the durable streak state.
- Added `components/ghc/use-daily-claim-status.ts` to reconcile UI state with the server and refresh on reward-day rollover, focus, visibility restoration, network return, and claim events.
- Updated Home card, claim sheet, and Rewards Centre journey hero to use server claimability when the server status is current for the Lagos reward day.
- The client detects reward-day rollover in a long-open tab every 30 seconds; focus/visibility restoration handles suspended tabs.
- Removed generic reward-evaluation fallback from the daily claim path. A daily claim must succeed through the atomic daily route or remain available for retry.
- Failed requests no longer consume the local claim state or display a false success notification.
- Added `scripts/test-rewards-reliability.mjs` and included it in static/CI verification.

## Database and deployment

No new Supabase migration is required for this change. The status endpoint reads the existing authoritative claim-streak RPC/state.

Deploy the application to Testnet Preview first. Verify that the reward becomes claimable at 00:00 Africa/Lagos, remains claimable after a failed request, cannot be credited twice, and updates after refresh/focus/network recovery. Confirm the wallet balance only changes after the authoritative ledger response. Promote to Mainnet after the complete build and live tests pass.

## Verification performed

- `node scripts/test-rewards-reliability.mjs`: passed.
- `node scripts/verify-phase14-static.mjs`: all 12 suites passed.
- TypeScript parser syntax checks passed for the changed route and three changed/new UI files.
- Full Next.js build, full typecheck, ESLint, and live Supabase/dual-account tests were not run in this environment because project dependencies were not installed.
