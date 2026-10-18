# Daily Rewards + Notification Attention Upgrade — 2026-10-18

## User-facing changes

- The claim card is mounted in the actual production `EnhancedFeedScreen` directly below Stories; it was previously only present in the legacy Home Command Centre surface.
- Until the authenticated daily-reward status endpoint confirms today's claim state, the feed keeps the claim visible. The server POST remains the only authority and its idempotent response prevents a second credit when the user already claimed on another device or in another tab.
- Notification Center now loads both durable social activity notifications and durable GHC/economy notifications, and combines their unread totals with local in-app notifications instead of overwriting one store's count with another.
- Opening an economy notification marks it read through the authenticated economy endpoint; Mark all as read updates both social and economy stores.
- Main navigation displays red attention dots for Home activity/alerts, unread Messages, pending Discover requests, and Profile account/group updates. Counts refresh on focus/online, known activity events, and a 15-second polling interval.
- On a returning user's first session after a release-version change, a deduplicated in-app system notification announces the update. First-time installs establish a baseline silently.

## Data / migrations

Apply `supabase/migrations/202610240007_gh_post_created_notifications.sql` to Testnet before testing durable new-post and new-message notifications. It extends the existing social notification type allow-list and adds service-role-only fan-out RPCs for eligible followers and active conversation members. It does not change GHC/Pi balances or economy ledger state. Apply the same reviewed migration to Mainnet only after Testnet validation. No new environment variable is required.

## Verification

Run `npm run test:notification-attention`, `npm run test:rewards-reliability`, `npm run test:daily-wallet`, `npm run test:economy`, `npm run verify:static`, and `npm run check:jsx`.

Static regression checks do not replace a full Next.js production build or live multi-user verification. Test in Vercel Preview with at least two accounts, confirm existing reward availability and social/GHC notifications are visible, mark alerts read, and verify the appropriate red dots clear after server confirmation.
