# Phase 16 — Payment lifecycle observability

Release: `0.105.0`

## Delivered

- Added `GET /api/payments/intents/[intentId]/timeline`.
- Requires an authenticated session and verifies the intent belongs to that user before returning its event history.
- Returns only persisted audit-event timestamps, action labels, actors, and details. It omits event metadata and internal payloads.
- Applies no-store response headers and performs no writes or provider calls.
- Adds a user-triggered “View stored payment history” panel in Pi payment details, with loading/error/retry states and an explicit empty-history message.
- Makes the boundary clear: intent audit events are not a complete Pi provider or blockchain event feed. Missing events and timestamps are never synthesized.
- Adds a static Phase 16 contract check and includes it in the combined static verification suite.

## Safety boundaries

No payment is retried, approved, completed, refunded, or fulfilled by this feature. It does not change order records, entitlements, wallet balances, Pi authentication, or GHC accounting. Existing intent-store durability requirements remain unchanged. Event detail strings are truncated for response size, but remain persisted user-visible audit data; operators should continue to avoid putting secrets into audit details.

## Verification status

Run `npm run check:phase16-payment-timeline` and `npm run verify:static` with a supported Node runtime. These are static source-contract checks, not live database, Pi Testnet, browser, or full TypeScript verification. The project's declared Node runtime is `24.15.0`; if the current environment is older, runtime guards should be respected rather than bypassed.
