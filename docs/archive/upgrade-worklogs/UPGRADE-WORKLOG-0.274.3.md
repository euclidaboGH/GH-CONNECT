> **LEGACY VERIFICATION FIXTURE** — superseded by current package worklog; retained for audit trail only.

# Upgrade worklog — 0.274.3

## Notification RPC EXECUTE privilege hardening

Testnet privilege audit showed:

- `gh_notification_inbox_list`: service_role only (correct)
- `gh_social_notifications_list`: EXECUTE granted to **anon** and **authenticated** (incorrect)

These functions are `SECURITY DEFINER`. Client-callable EXECUTE would allow arbitrary `p_recipient_id` / `p_recipient_user_id` reads.

### Migration

`20261101160001_harden_notification_rpc_execute_privileges.sql` (privilege-only):

REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role for:

- gh_notification_inbox_list / unread_count / mark_read
- gh_social_notifications_list / unread_count / mark_read
- gh_social_notification_create

Does not change function bodies, notification rows, wallet, or earnings.

### Related

- `20261101150001` still required for `q."createdAt"` ORDER BY fix (42703).
- Do not use fee_bps ensure migration for the original 42703.

Source-level / source-only verification only. Supported runtime: Node.js 24.15.0.
Apply on disposable PostgreSQL, then Testnet. Re-run privilege diagnostic after apply.
Document date: 2026-11-01.
