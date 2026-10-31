> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 6 continuation — 3% withdrawal fee (0.164.0)

## Policy
- **Fee:** 3% of gross withdrawal (`fee_bps = 300`)
- **Net (97%):** sent via A2U to the **Pi wallet linked at authentication** (`gh_pi_identities.pi_app_uid`)
- **Recipient:** never taken from the client body
- **Wallet authorization** still required when Phase 2 consent table is present

## Delivered
- Migration `20261029010011_gh_earnings_withdrawal_fee_3pct.sql`
- `gh_earnings_quote_withdrawal` RPC
- Enriched `gh_earnings_withdrawable` (feeBps, linked Pi identity)
- `POST /api/economy/earnings/quote`
- Helpers: `quoteWithdrawal`, `previewWithdrawalFeeAtomic`

## Example
Gross 10 PI → fee 0.3 PI → net 9.7 PI to linked Pi user
