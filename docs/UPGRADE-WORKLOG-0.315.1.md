# UPGRADE WORKLOG — 0.315.1

**Date:** 2026-11-05

## Source-only verification · Node.js 24.15.0 runtime limitation

## Change
Wallet PI surface is professional and non-duplicated:

- Action keys on PI: **Withdraw** + **History** only (no Status / Linked duplicates).
- Earnings card: **one** Withdraw button → opens `PiWithdrawSheet`.
- Removed second Authorize card and Preview fee button from the wallet PI rail.
- Consent, fee preview, PIN, and submit live inside the sheet only.
- Settings retains authorization card for revoke/manage.

No financial gate weakened.
