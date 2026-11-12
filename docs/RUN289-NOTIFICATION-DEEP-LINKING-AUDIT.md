# Run #289 — Notification Targeting and Delivery Audit

Date: 2026-11-11

## Expected recipient experience

| Event | Destination | Required target context |
|---|---|---|
| Post activity | Feed | Exact post ID |
| Comment | Post comments | Post + comment IDs |
| Reply | Exact comment thread | Post + reply + parent/root IDs; paginate until target loads |
| Marketplace listing response | Listing detail | Listing + post/comment IDs |
| Marketplace order update/payment | Marketplace Orders | Order + listing IDs; response action/timestamp focuses the exact timeline event |
| Pi payment | Wallet → Pi history | Payment intent + provider transaction reference |
| GHC transfer | Wallet → GHC history | Ledger transaction/reference ID |
| Daily reward claim | Rewards → History | Claim/reward + ledger reference |
| Transfer request | Wallet → Requests | Request ID |
| Direct message | Messages | Conversation ID + peer ID |

## Architectural repairs

- One resolver handles both explicit `deepLink` envelopes and legacy flattened metadata. It sanitizes target IDs and does not accept arbitrary external URLs as target identifiers.
- The notification list opens the target on its primary tap. A separate overflow/details control retains the channel-history view.
- The unified inbox is the canonical projection. Legacy social/economy rows are only added if their prefixed projection ID is absent, preventing duplicate rows/unread counts while retaining recovery behavior.
- Unified read state is persisted first; legacy read markers are synchronized with the unprefixed source ID.
- Comment participants are resolved server-side from the post or exact nested reply thread, bounded to avoid notification fan-out, and still pass through existing block-aware RPC checks. The comment sheet pages older responses until the notified comment is loaded, expands the root thread and scrolls to the reply. Listing-linked social comments continue to open the Feed post so the comment is visible.
- Wallet, Rewards and Marketplace target state is handed through app state or a one-shot session target so a lazy component cannot miss a single navigation event. Marketplace order response events carry action/time and scroll to the matching timeline entry.
- Payment/order notices use the existing durable inbox RPC and dedupe keys. No client balance, transaction, entitlement or payment state is created.

## Live dependency checks

- Supabase Testnet has `gh_notification_inbox_create` and `gh_notification_event_append` RPCs.
- Social and economy notification projection triggers exist.
- `gh_posts.listing_id` exists, enabling listing-aware comment routing.
- Existing inbox constraints require a non-empty recipient, non-empty dedupe key and JSON object metadata; they do not restrict the new event-type strings.
- No SQL migration is required for this tranche; no migration was applied.

## Open acceptance items

- Run full Node 24.15.0 install, typecheck, lint and production build.
- Verify the full flow with two Testnet accounts: post owner, multiple commenters/repliers, listing seller/buyer, PI payer, GHC sender/recipient and daily claimant.
- Confirm row-level navigation and scroll focus on Android/Pi Browser and desktop, including deleted/private targets and account switching.
- Synchronize the 0.338.52 source to GitHub `testnet` through a reviewed PR; the connected branch is still 0.338.49.
- Redeploy through Vercel only after source synchronization and successful CI.
