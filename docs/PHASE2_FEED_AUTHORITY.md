# Phase 2 — Feed authority

- `mapRemoteFeedPosts`: snake_case + camelCase, community, listing, hashtags, shares, views
- `refreshFeed` merges when `ok` + non-empty posts (durable not required)
- After durable publish: immediate feed revalidate
- Foreground focus / visibilitychange: soft revalidate (min 45s interval)
- Initial hydrate uses same mapper

Operator: social RPCs + auth still required for true multi-user visibility.
