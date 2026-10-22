# Notification center upgrade (0.70.0)

## Behaviour
- Notifications keep **history per channel** (actor + surface + entity), similar to DM threads.
- Tap opens an **expanded detail** view with full message and earlier items in that channel.
- **Delete** removes the item and remembers the id so it does not reappear from local merge.
- Filter tabs: All · Social · Messages · GHC · Rewards · Requests · Community · **Market** · System.
- Server emits for likes/reactions, comments/replies, and curation **upvote/downvote** with clear titles.
- Client helpers: `notifyContentEngagement`, `notifyMarketplaceEvent`.

## Storage
- Local history cap raised to **300**.
- Durable social/economy/announcement sources still merged on refresh; deleted ids filtered out.
