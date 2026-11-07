# Wallet review — PI and GHC upgrades (source-only)

Scope: PI earnings wallet and GHC utility wallet. No database migration, no ledger rewrite, no Mainnet change. Production remains NOT APPROVED.

## PI (10)
1. Shared exact amount helpers (`lib/wallet/pi-amount.ts`) with runtime tests.
2. Typed amounts parsed exactly (string/integer math, max 7 decimals, no exponent/sign).
3. Withdraw sheet no longer pre-fills the whole balance (this caused accidental full reservations); Max is one tap, floored and capped.
4. Inline validation and over-balance notice (`aria-invalid`, `role=alert`).
5. Withdrawals route refuses to reserve PI while payout execution is disabled; friendly message, balance untouched.
6. Balance card keeps failing closed (never shows an unconfirmed balance); refresh button reports busy state.
7. Balance refreshes on tab visibility (30 s throttle) and on reconnect.
8. Reserved PI is explained on the balance card; fee copy clarified.
9. Accessibility: hidden-balance label, Max aria-label, invalid-field semantics.
10. Operator script to release unstarted reservations (`scripts/ops/release-unstarted-pi-payout-reservations-testnet.sql`).

## GHC (10)
1. Shared exact amount helpers (`lib/wallet/ghc-amount.ts`) with runtime tests.
2. Withdrawal amount parsed exactly at 4 decimals (no float drift); text input with decimal keypad instead of `type=number`.
3. Max button floored to 4 dp so it can never exceed the withdrawable balance.
4. Over-withdrawable amounts blocked with an explanation that locked GHC stays in the wallet.
5. PI preview floored (never rounds up) using integer-safe math.
6. Pi wallet address shape validated before submit (G + 55 base32 characters).
7. Minimum copy driven by the server quote instead of a hard-coded 100.
8. Withdrawal history uses human status labels; Refresh disables while loading.
9. Formatter is negative/-0 safe; invalid timestamps render as an em dash; extra statuses mapped.
10. Transaction rows have a descriptive accessible name and 44 px minimum height.

## Verification
All 177 prebuild checks that can run on Node 22 pass; `check-node-runtime` fails only because this sandbox is not Node 24.15. TypeScript, ESLint, Next build and device tests were not run.
