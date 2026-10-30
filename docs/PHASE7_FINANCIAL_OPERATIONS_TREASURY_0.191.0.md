# Phase 7 — Financial operations and treasury (0.191.0)

## Delivered in source
- Evidence-backed aggregate RPC `gh_treasury_financial_report(starts_at, ends_at)`.
- Revenue journal grouped by currency and event type, preserving minor-unit values as text (including marketplace_fee classification).
- GHC ledger reporting: signed posted and pending ledger movements, debits/credits, net period movement and transaction counts; this is not a token-supply or per-user available-balance statement.
- Marketplace seller reporting: current unallocated completed/verified order gross snapshot (not net seller payable) plus requested, paid, and failed/rejected payout request totals, grouped by PI and GHC.
- PI earnings payout reporting: reserved and paid gross, fee, and net atomic units; released/failed gross and request count.
- PI cashback reporting: calculated liability, needs-review amount, reserved A2U, paid A2U, outstanding amount, and attention count. Calculated liability is not funding proof.
- Creator tip payable, paid, and disputed/refunded totals, kept distinct from provider disbursement.
- Durable operator cases with append-only event history, status, priority, summary, actor label, and resolution timestamp.
- Operator-protected `/admin/treasury` dashboard and read-only report / case APIs.
- Existing treasury summary now includes the financial report and operator cases and degrades when those sources are unavailable.

## Accounting boundaries
- PI and GHC are separate assets; currency totals are never summed or converted.
- Revenue journal records company revenue evidence, not seller payable or wallet balances.
- Seller payout request totals are not a full seller-level liability balance sheet. Unallocated completed verified order gross is not net seller payable because fee/net seller allocation cannot be safely inferred from order gross alone. It is shown as a current snapshot, not historical period revenue. Paid request totals are filtered by paid_at.
- PI earnings reservation totals are payout-request states; they are not user wallet available balances.
- Cashback entitlement is calculated liability; reserved and paid A2U states are reported separately. The report includes full four-month entitlement periods that overlap the selected reporting window; it does not prorate those liabilities into calendar quarters. Unavailable source evidence must not be treated as zero.
- Creator tips in payable state are obligations, not completed payouts.
- Operator case notes are audit metadata and do not change source payment state, settle payouts, or release reservations.

## Migration and validation status
- `20261030010008_phase7_treasury_reporting_and_case_history.sql` is REVIEW_REQUIRED and not applied.
- Static source-contract tests are not a substitute for disposable PostgreSQL execution. Required: migration replay from a clean database, grants/RLS checks, duplicate/concurrent case writes, concurrent report reads during payout transitions, aggregate reconciliation against independently queried source rows, and rollback/recovery testing.
- Node 24 typecheck, lint, Next production build, authenticated browser testing, and Pi Testnet evidence remain release gates.
