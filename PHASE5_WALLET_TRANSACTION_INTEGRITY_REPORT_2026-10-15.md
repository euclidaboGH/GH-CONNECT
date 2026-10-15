# GreenHaven Phase 5 — Wallet & Transaction Integrity

## Scope
Production-hardening pass for GHC wallet read authority, spendable balance consistency, reservations, and transaction display. Pi payment, rewards policy, membership entitlement rules, and marketplace business rules were not redesigned.

## Critical issue fixed: bounded ledger was being used as wallet authority
The server wallet endpoint already calculated a full-ledger `snapshot`, but the HTTP economy repository discarded that snapshot during hydrate. `getWallet()` then recomputed balance from the locally cached activity list, while the API intentionally bounds that list to at most 200 rows. A mature account could therefore display a balance based on only recent activity.

Fix: server-mode EconomyRepository now retains the authenticated full-ledger snapshot and EconomyDomain returns it as wallet authority. The bounded transaction list remains presentation/history only.

## Critical issue fixed: displayed Available could exceed actually spendable GHC
The debit RPCs already use `ghc_spendable_balance`, which subtracts active withdrawal reservations. The older wallet snapshot exposed posted ledger balance as `balance`, so the UI could show GHC as Available even though the server correctly refused to spend it.

Migration `202610150003_ghc_wallet_snapshot_spendable.sql` makes the wallet snapshot use the same spendable function as debit authorization. It also returns `ledgerBalance` and `locked` separately.

Result:
- Available = server-authoritative spendable GHC
- Pending = positive pending ledger credits
- Reserved = server-side reservations, currently pending withdrawal locks
- Ledger total = retained separately for accounting/debugging; not presented as spendable

No marketplace escrow amount is fabricated. Marketplace escrow should only be surfaced when a durable escrow reservation source exists.

## UI
Wallet balance hero now exposes Reserved separately and labels it Not spendable. Send/spend checks continue to use `wallet.balance`, which now matches server debit authorization after the migration is applied.

## Concurrency and idempotency audit
Existing migration `20261009_ghc_balance_lock_and_spendable.sql` already serializes spend/transfer/withdrawal debit authorization with the shared `ghc_balance:{user}` advisory-lock namespace and uses stable reference IDs for idempotency. This pass preserved those protections rather than creating a second money-movement path.

## Verification
- `node scripts/check-jsx-safety.mjs`: PASS (613 files)
- Full Next build not executed from this extracted artifact because dependencies/node_modules are not bundled.

## Deployment requirement
Apply migrations in order, including existing withdrawal/balance-lock migrations before `202610150003_ghc_wallet_snapshot_spendable.sql` because the new snapshot calls `ghc_spendable_balance`.
