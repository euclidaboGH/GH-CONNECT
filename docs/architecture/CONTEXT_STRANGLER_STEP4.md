# GHCContext strangler Step 4

## Added

- `session-bootstrap.ts` — production empty collections; Studio may seed
- `ConnectionsProvider` — read-only graph summary seam
- `DiscoveryProvider` — read-only discovery search seam

## Explicit empty policy

Production load paths call `bootstrapPosts/Stories/Candidates/Likes` which return `[]` when demo is disallowed. UI should show domain empty states, not “seed that happens to be empty.”

## Not migrated

- Connection/discovery **mutations** (still unified adapters / GHC)
- Messaging, communities, notifications
- Financial writes
