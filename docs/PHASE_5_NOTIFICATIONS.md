# Phase 5 — Notifications delivery

## Done
- `NOTIFICATIONS_CHANGED_EVENT` after local add/read
- `notifyRewardClaimed` / `notifyContentEngagement` helpers
- Daily claim writes in-app reward notification
- Bell listens: notifications-changed, daily-reward-claimed, post-engagement, new-message
- Soft browser Notification permission on panel open
- Curation social types map toward engagement icons
- Existing durable `/api/social/notifications` merge retained

## Not changed
- Server notification schema / RLS
- Push provider credentials (FCM etc.) — browser Notification API only when permitted
