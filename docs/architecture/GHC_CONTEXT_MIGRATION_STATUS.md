# GHC Context Migration Status

Statuses: NOT STARTED | SEAM CREATED | CONSUMER MIGRATED | LEGACY FACADE | SAFE TO REMOVE

| Field / concern | Status | Notes |
|-----------------|--------|-------|
| IdentityService session | SEAM CREATED | `IdentityProvider` + IdentityService |
| Profile snapshot contract | SEAM CREATED | `createIdentitySeam` / getProfileSnapshot |
| Profile writes (updateProfile) | LEGACY FACADE | Still via GHCProvider |
| Feed posts list contract | SEAM CREATED | `FeedProvider` + `createFeedSeam` |
| Feed mutations (create/like) | LEGACY FACADE | Still GHCProvider / useGHCFeed |
| Wallet balance display | SEAM CREATED | `WalletReadProvider` read-only |
| Wallet transfers/claims | NOT STARTED (intentionally) | Economy domain only |
| Discovery | NOT STARTED | |
| Connections | NOT STARTED | |
| Messaging | NOT STARTED | |
| Communities | NOT STARTED | |
| Notifications | NOT STARTED | |
| GHCProvider whole file | LEGACY FACADE | Required compatibility |

## Provider hierarchy

```
IdentityProvider
 └── FeedProvider
      └── WalletReadProvider
           └── GHCProvider (compatibility facade)
                └── App
```

## Financial non-regression

No economy ledger, claim, Pi, or membership grant logic moved into the new providers.


## Step 4 update

| Field / concern | Status | Notes |
|-----------------|--------|-------|
| Connections summary seam | SEAM CREATED | `ConnectionsProvider` + `createConnectionsSeam` |
| Discovery search seam | SEAM CREATED | `DiscoveryProvider` + `createDiscoverySeam` |
| Session bootstrap empty states | SEAM CREATED | `session-bootstrap.ts` — production returns `[]` explicitly |
| Feed/posts load path | LEGACY FACADE | Uses `bootstrapPosts()` not raw seed naming |
| GHCProvider | LEGACY FACADE | Still required |

Hierarchy:

```
IdentityProvider
 └── ConnectionsProvider
      └── DiscoveryProvider
           └── FeedProvider
                └── WalletReadProvider
                     └── GHCProvider
```
