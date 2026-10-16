# GHC Context Dependency Map (Prompt #50.1)

Source: `contexts/ghc-context.tsx` (~4261 lines) + internal sub-contexts.

## Classification of state / actions

| Area | Ownership today | Proposed | Notes |
|------|-----------------|----------|-------|
| IDENTITY | IdentityService + Pi auth | IdentityProvider | Already external; page-wired in 50.1 |
| PROFILE | state.profile, updateProfile | Identity seam + profile slice | Writes via existing paths |
| FEED/SOCIAL | state.posts, stories, createPost, like… | FeedProvider + createFeedSeam | No GHC rewards for social actions |
| DISCOVERY | candidates, swipe | Later seam | Not migrated in 50.1 |
| CONNECTIONS | friends, follow, block | Later | Unified connection adapter exists |
| MESSAGING | conversations | Later | |
| COMMUNITIES | groups + localStorage D | Later | Class D cache labeled in #50 |
| EVENTS/ACTIVITIES | community adapters | Later | |
| NOTIFICATIONS | notificationSystem | Later | |
| REPUTATION | localStorage D | Later | |
| VERIFICATION | localStorage D + prod block | Later | Privileged mutations blocked in prod |
| GHC / WALLET | domains.economy | WalletReadProvider **read-only** | Writes frozen on economy domain |
| REWARDS / CLAIMS | economy | **Do not extract writes** | Server authoritative |
| MEMBERSHIP | economy / entitlement | Display via wallet read only | Grant path frozen |
| PI | payment routes | Status display only | Completion frozen |
| MARKETPLACE | marketplace domain | Later | |
| UI/PREFERENCES | tab, toasts, settings | Keep in GHC shell | |

## Cross-domain dependencies

- Feed createPost → may touch analytics/notifications (OK)
- Profile update → IdentityService userId (OK)
- Wallet UI → getBoundDomainServices().economy.getWallet (READ)
- Economy mutations → never from FeedProvider / IdentityProvider

## Migration order

1. IdentityProvider (done / reinforced)
2. FeedProvider seam (done)
3. WalletReadProvider (done)
4. Connections / Discovery
5. Messaging
6. Communities
7. Notifications

## Risky consumers

- `features/wallet/wallet-screen.tsx` — still uses economy domain for writes (correct)
- `components/ghc/app.tsx` — uses useGHC / useGHCShell
- Internal `useGHCFeed` / `useGHCProfile` — remain valid facade hooks

## Compatibility

`GHCProvider` remains required. New providers wrap it; they do not replace financial authority.
