# Project audit — leftovers, gaps, duplicates 0.89.0

## Findings & actions

| Finding | Severity | Action |
|---------|----------|--------|
| `APP_RELEASE_VERSION` stuck at **0.72.1** while package claimed 0.88 | High | Synced to **0.89.0** |
| `package-lock.json` root version **0.72.1** | High | Synced to **0.89.0** |
| Settings `ghc:open-settings-section` only allowed wallet/rewards/membership/help | Medium | Matched app shell: privacy, notifications, appearance, device-lock |
| `screens-complete.tsx` / `home-screen-stub.tsx` dual export barrels | Low | Documented legacy; production uses `app.tsx` + EnhancedFeedScreen |
| `features/profile` + `components/ghc/profile-screen` | Low | Intentional re-export; single implementation |
| `premium-wallet-screen` re-export of features/wallet | Low | Intentional compatibility |
| Discovery "events coming soon" copy | Info | Product honesty, not a broken link |
| Mission progress fail-closed | Info | By design until server verification |

## Not removed (on purpose)

- Deprecated stubs that other module graphs import
- Placeholder assets under `public/`
- Backup recovery helper (`lib/backup-recovery.ts`)

## Verify

1. `APP_RELEASE_VERSION === package.json version`
2. Settings deep-link to privacy/notifications works from events
3. No dual-send DM / LazyImage media path regressions from prior versions

Version **0.89.0**
