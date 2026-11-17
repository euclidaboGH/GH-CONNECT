-- Harden EXECUTE privileges on notification list/mutation RPCs.
-- Evidence (Testnet): gh_social_notifications_list was executable by anon + authenticated
-- while SECURITY DEFINER. Callers must be server/service_role only; client must not
-- supply arbitrary p_recipient_id to read another user's notifications.
--
-- Idempotent privilege-only migration. Does not change function bodies, tables, or data.
-- Complements 20261101150001 (createdAt ORDER BY fix).

REVOKE ALL ON FUNCTION public.gh_notification_inbox_list(text, integer, timestamptz, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_inbox_list(text, integer, timestamptz, text, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.gh_notification_inbox_unread_count(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_inbox_unread_count(text)
  TO service_role;

REVOKE ALL ON FUNCTION public.gh_notification_inbox_mark_read(text, text[], boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_notification_inbox_mark_read(text, text[], boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.gh_social_notifications_list(text, integer, bigint, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_list(text, integer, bigint, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.gh_social_notifications_unread_count(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_unread_count(text)
  TO service_role;

REVOKE ALL ON FUNCTION public.gh_social_notifications_mark_read(text, text[], boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_social_notifications_mark_read(text, text[], boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_social_notification_create(text, text, text, text, text, text, text, text, jsonb)
  TO service_role;
