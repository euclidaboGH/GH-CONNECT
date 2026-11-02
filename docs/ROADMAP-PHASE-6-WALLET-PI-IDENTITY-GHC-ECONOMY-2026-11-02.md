# GH-CONNECT Roadmap Phase 6 — Wallet, Pi Identity & GHC Economy

Date: 2026-11-02

## Implemented in this slice

- Added a route-level exception boundary around authentication, database configuration and the authoritative GHC wallet snapshot call. Unexpected dependency exceptions return a stable retryable `503` JSON response rather than bubbling into a framework error screen.
- Database/RPC unavailable responses are non-cacheable and include `Retry-After` guidance.
- Successful snapshots include a server-generated `snapshotFetchedAt` timestamp and `sourceStatus: authoritative_snapshot` so clients can distinguish a current successful response from an error response.
- Existing ledger authority (`ghc_transactions` / `server_ledger`) and `noClientMinting` declaration remain intact.
- Added `scripts/check-roadmap-phase6-wallet-economy.mjs`, registered in `prebuild` and `verify:static`.

## Financial and security invariants

- No client-side balance fallback, synthetic balance, minting, payment status, or transaction record was added.
- No migration, financial RPC, fee, payout, Pi authentication rule, authorization policy, or dependency was changed.
- Authentication failure remains `401`; backend dependency failures remain explicit `503` responses.

## Verification limits

The phase checker validates source contracts only. It does not prove the live database RPC exists, its grants are correct, balances reconcile, or the client renders the timestamp. Run supported Node 24.15.0 install, typecheck, lint, production build, and authenticated Testnet integration tests before deployment.

## Continuation — client-side wallet transport hardening

- Added `WalletV2RequestError`, a typed error carrying HTTP status, retryability and bounded `Retry-After` seconds. Existing callers can use these fields to present retry guidance without parsing message text.
- Wallet response parsing now tolerates HTML/empty/malformed response bodies from proxies or framework error pages and maps them to a stable wallet error rather than surfacing a JSON parse exception.
- Success envelopes are validated before snapshot normalization. A malformed `200` response fails closed with `WALLET_INVALID_SNAPSHOT`; it never becomes an empty or zero-balance wallet.
- Retryability is derived from the explicit server flag plus HTTP 429/5xx status. `Retry-After` parsing rejects invalid values and caps guidance at 300 seconds.
- Added six client-contract assertions to the Phase 6 checker. No financial mutation, database contract, migration, permission or dependency was changed.

## Continuation verification

- `npm run verify:static`: passed in the available environment.
- `scripts/check-roadmap-phase6-wallet-economy.mjs`: 18/18 passed.
- `scripts/check-phase3-authoritative-wallet-snapshot.mjs`: 6/6 passed.
- `scripts/check-phase3-wallet-reconciliation-truthfulness.mjs`: 8/8 passed.
- `scripts/check-phase8-wallet-history-foundation.mjs`: 20/20 passed.
- `scripts/check-phase9-wallet-transaction-integration.mjs`: 41/41 passed.
- `scripts/check-jsx-safety.mjs`: passed, 939 files scanned.
- Full TypeScript, ESLint, production build and live Testnet/Supabase integration remain separate release gates; this static run does not replace them.
