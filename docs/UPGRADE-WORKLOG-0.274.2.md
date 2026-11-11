> **LEGACY VERIFICATION FIXTURE** — superseded by current package worklog; retained for audit trail only.

# Upgrade worklog — 0.274.2

## Confirmed PostgreSQL 42703: notification list ORDER BY

### Root cause (verified against deployed Testnet definitions)

Inner subqueries alias timestamps as quoted `"createdAt"`. Outer `jsonb_agg(... ORDER BY q.created_at)` references a different identifier. PostgreSQL raises SQLSTATE 42703 (`column q.created_at does not exist`).

Affected functions:
- `public.gh_notification_inbox_list`
- `public.gh_social_notifications_list`

Same defect class previously fixed for `gh_post_list_feed` in `20261022010038`.

### Not the cause of this 42703

- `gh_earnings_payout_policy.fee_bps` — already present on Testnet; optional ensure migration is not required for this error.
- `ghc_create_transfer_request` / `ghc_record_notification_event` — no executable `q.created_at` ORDER BY defect established.
- Withdrawals health probes — do not call notification list RPCs. 0.274.1 probe hardening remains valid independently.

### Fix

Migration `20261101150001_fix_notification_list_createdAt_order.sql`:
- Outer ORDER BY → `q."createdAt"`
- Preserve JSON field `createdAt`, signatures, filters, pagination, SECURITY DEFINER, service_role-only EXECUTE

Regression: `npm run check:notification-list-createdat-order` (15/15).

Source-level / source-only verification only. Supported runtime: Node.js 24.15.0.
Apply migration on disposable PostgreSQL, then Testnet, then re-check PostgreSQL logs for remaining 42703.
Document date: 2026-11-01.
