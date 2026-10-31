# Profile section — overview, wiring & hardening 0.86.0

## Product model

| Surface | Role |
|---------|------|
| **Owner profile** | Identity, media, posts, listings, communities, about, ecosystem |
| **Visitor profile** | Peer preview from Discover/Matches — Message · Follow · Like/Pass |
| **Identity** | GreenHaven ID, handle, verification, membership badges |

Media is durable (compress → upload → relative facade URL → LazyImage signed resolve).  
Local data URLs only as offline fallback.

## Architecture

```
ProfileScreen (owner)
├── Slim header · cover (h-28) · avatar
├── Stats · completion nudge · membership badge
├── ProfileSectionTabs: Posts · Media · Listings · Communities · About
├── Ecosystem hub · stories · content library
├── Edit modal · photo sheet · share
└── Dashboard tools (wallet, membership, rewards)

ProfilePreviewPage (visitor)
├── Hero media · dual CTAs
├── Follow / Message / Like / Pass / block-report
└── Public posts library

Media
├── compressImageFile → uploadDurableMedia
├── toRelativeMediaFacadeUrl
└── LazyImage → resolveDisplayMediaUrl
```

## Cross-feature wiring

| Feature | Link |
|---------|------|
| Feed | Own posts · OwnPostCard · engagement |
| Marketplace | Profile Listings tab |
| Community | My communities |
| Messaging | Visitor Message CTA |
| Match/Discover | Profile preview · follow |
| Wallet / Membership / Rewards | Ecosystem + dashboard |
| Referral | Ecosystem hub share card |
| Media private bucket | Facade + LazyImage |

## Hardening in 0.86.0

1. **VIP/VVIP badge** on owner profile from `/api/membership/status`  
2. Listens for **`ghc:membership-activated`** to refresh badge  
3. **`ghc:profile-media-updated`** after durable photo/cover upload  
4. **Visitor VIP badge** when candidate carries membership tier  

## Already solid (kept)

- Compact cover · LazyImage · durable upload + facade  
- Section tabs · listings · communities  
- Follow counts from identity overview  
- Offline photo local fallback with honest toast  

## Verify

1. Upload avatar/cover → displays (not initials-only)  
2. VIP after membership shows badge on profile  
3. Visitor profile Message + Follow work  
4. Listings/Communities tabs populate from real data  
5. Share profile copies/opens public link  

Version **0.86.0**
