# Phase 2 — Wallet product transformation (0.330.20)

## Audit conclusion

The 0.330.19 baseline already contains a mature dual-asset Wallet: separate GHC and Pi ledgers, a server-confirmed GHC read provider, a read-only Pi withdrawable snapshot, PIN-bound GHC withdrawal, fresh Pi SDK consent, idempotent payout intents, server-authoritative reward claims, payment reconciliation, bounded requests and latest-request-wins cancellation. Replacing this with a new wallet implementation would duplicate authority and create financial risk. This phase therefore improves comprehension, transparency and refresh correctness around the existing authorities.

## Implemented

### Balance hierarchy

- GHC hero shows available balance only when the GHC snapshot is server-sourced and validated.
- GHC pending, locked and escrow-locked values are separately labelled.
- Pi available, withdrawable, pending and reserved values remain on the Pi rail and are never combined with GHC.
- The hide/show preference is held in `sessionStorage` for the current browser session only; it does not persist across sessions or accounts.

### Statement and transaction clarity

- Added `summarizeGhcStatement`, a pure presentation helper for the currently loaded and filtered GHC rows.
- Settled incoming/outgoing movement is separate from pending movement.
- Failed, reversed, cancelled, canceled and expired rows are excluded from settled totals.
- Summary copy reports the number of settled records represented.
- The UI explicitly discloses the current 80-record local hydration ceiling and says that older-record pagination is not available in this release. It does not imply a complete lifetime statement.
- Existing date filters, transaction-type filters, search, clear-filters action, transaction detail and PI payment-intent history remain in place and separate.

### Refresh correctness

- `WalletReadProvider.refresh()` now resolves to a boolean indicating whether that request actually obtained and committed the latest server snapshot.
- Existing abort, timeout, latest-request-wins and last-server-confirmed snapshot behavior remain.
- Manual Wallet refresh awaits the authoritative provider read. The successful-sync timestamp advances only when that read returns confirmed success; a failed read leaves the stale/unavailable state visible.

## Regression coverage

`check-phase2-wallet-product-transformation-20261107.mjs` is registered in both `prebuild` and `verify:static`. It checks the privacy scope, separate asset rails, server-confirmed display, escrow visibility, statement treatment, history-limit disclosure and awaited server refresh. Existing Wallet history, premium-home, dual-asset, withdrawal journey, PIN hardening, Pi consent and ledger resilience contracts remain registered and pass in the available static environment.

## Not included / still required

- No GHC/Pi ledger, database schema, migration, RPC, RLS, settlement, payout, reward issuance, refund, transfer or payment authority changed.
- No unsupported cursor pagination API was invented. Full server-side cursor history is a future increment requiring a bounded authenticated API contract and corresponding database/query evidence.
- Node 24.15.x typecheck, ESLint and production build; browser/mobile/Pi Browser; live Supabase multi-user/RLS; Pi Testnet payment and withdrawal evidence; and operator acceptance remain required.
- Production status remains NOT APPROVED.
