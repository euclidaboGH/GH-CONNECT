# GreenHaven — system overview & cross-hardening 0.88.0

## What GreenHaven is

A Pi-browser social + commerce platform with:

- **Social graph** — feed, posts, comments, curation, stories, discover, matches, messaging, communities  
- **Commerce** — marketplace listings/orders, dual-rail fees (GHC / π)  
- **Economy** — GHC utility ledger, daily claim, packs, membership, referral, utility sinks  
- **Identity** — profiles, GreenHaven ID, media, membership badges  

**Authority rule:** durable server state (Supabase / ledger / RPCs) wins. UI never invents balances, entitlements, or social writes.

## Primary surfaces (bottom nav)

| Tab | Role |
|-----|------|
| Home | Feed, claims prompt, interstitials |
| Discover | People, filters, like/pass/connect |
| Create | Compose posts/stories |
| Messages | DM + threads, media, order context |
| Profile | Identity, media, listings, communities, settings entry |

Secondary: Matches, Communities, Marketplace, Wallet, Rewards, Membership via Profile / Settings / deep-links.

## Section map (recent hardening)

| Area | Version | Focus |
|------|---------|--------|
| Media display | 0.73.1 | LazyImage + facade signed URLs |
| Marketplace | 0.74–0.76 | Dual-rail fees, durable CRUD, checkout |
| Community | 0.77–0.78 | Covers, fees, membership |
| Messaging | 0.79 | Dedup send, media bubbles |
| Notifications | 0.80 | Buckets, deep links, mark-read |
| Match / Discover | 0.81 | Inbox enrich, Likes you, filters |
| Referral | 0.82 | Status API, share card stats |
| Wallet | 0.83 | Dual-rail clarity, live refresh |
| Rewards | 0.84 | Claim notify, missions honesty |
| Membership | 0.85 | Activate events, recover purchase |
| Profile | 0.86 | VIP badge, media events |
| Settings | 0.87 | Server membership subtitle, invite, browser alerts |
| **System** | **0.88** | Event catalog, settings deep-link expand |

## Economy dual-rail

| Asset | Role |
|-------|------|
| **GHC** | In-app utility (rewards, transfers, fees, sinks) |
| **π** | External payment rail (GH Pay) — never mixed into GHC balance |

No free FX. Packs = verified Pi → fixed GHC credit. Settlement flags gate referral/activity.

## Cross-event bus (canonical)

See `lib/realtime/app-events.ts` (`GHC_APP_EVENTS`).

Critical paths:

- Claim / pack / utility / membership → `wallet-synced` / `wallet-refresh`  
- Membership activate → badge on profile + settings subtitle  
- Toast → `ghc:toast` → app shell `addToast`  
- Notifications → tab/open deep links (marketplace, matches, messages, membership)  

## Hardening in 0.88.0

1. **`GHC_APP_EVENTS`** catalog for consistent wiring  
2. Settings deep-links expanded: privacy, notifications, appearance, device-lock  
3. App shell `settingsInitialSection` type widened to match  

## Operator gates (testnet)

Typical private env (examples):

- `GHC_TESTNET_UNLOCK=1`  
- `GHC_BUY_WITH_PI_ENABLED=true`  
- `GHC_ACTIVITY_REWARDS_ENABLED` / `GHC_CURATION_REDISTRIBUTE_ENABLED`  
- `GHC_REFERRAL_SETTLEMENT_ENABLED`  
- Fee amounts: marketplace listing / community create GHC+π  
- Withdrawals / A2U / tips: keep **off** until mainnet evidence  

## Verify matrix (smoke)

1. Build typechecks on Vercel testnet  
2. Daily claim → wallet pending/available path  
3. Marketplace list with GHC or π fee  
4. Community create fee dual-rail  
5. DM send once (no double) + media  
6. Vote/comment/save without RPC 404  
7. Membership Pi/GHC + recover if needed  
8. Profile avatar/cover display via LazyImage  
9. Notification deep links land on correct surface  

## What is not claimed

Live mainnet evidence, full mission verification issuance, and regulatory exchange features remain gated. Source readiness ≠ production evidence.

Version **0.88.0**
