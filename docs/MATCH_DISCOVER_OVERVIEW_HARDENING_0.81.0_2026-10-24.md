# Matches · Discover · Connect · Like · Pass — overview & hardening 0.81.0

## Product model (clarity)

| Action | Meaning |
|--------|---------|
| **Like / Interest** | One-way signal for matching — not a friend request |
| **Pass** | Hide / downrank; durable when online |
| **Match** | **Mutual** like only — opportunity to message / connect |
| **Connect** | Intentional connection **request** (intent picker) → accept → friends |
| **Follow** | Separate asymmetric graph (not Match) |

## Architecture

```
Discover (discovery-grid-screen)
├── People / intents / filters
├── Like → swipe("like") → POST /api/matching/signal
├── Pass → swipe("pass") → same API
└── Connect → intent picker → /api/connections/request

Matches (match-screen)
├── New | All | Likes you
├── Mutual matches from local + durable inbox hydrate
├── Message / Connect / Profile
└── Connection requests inbox overlay

Server
├── ghc_match_signals (like/pass/superlike)
├── Mutual detection + social notification
└── Connection request/accept/decline APIs
```

## Cross-feature wiring

| Feature | Link |
|---------|------|
| Messaging | Match → startConversation / celebration Message |
| Notifications | Mutual → "It's a Match"; deep link → Matches |
| Profile | Open profile from cards |
| Connections | Connect ≠ Like; inbox on Matches |
| Discover | Excludes self, friends, blocked, existing matches |

## Hardening in 0.81.0

1. **Match inbox hydrate** fills names/photos from candidates when server only returns ids.  
2. **Discover** filters out friends, blocked, and existing matches.  
3. **Likes you** tab lists incoming non-mutual likes.  
4. **MatchTabs** three-way: New · All · Likes you.  
5. **Notification** type `match` opens Matches tab.

## Already solid (kept)

- Server-first like/pass when online  
- Match celebration modal  
- Connection intent picker  
- MATCH_CLARITY copy  
- LazyImage on MatchCard  

## Env / Supabase

- Migration `20261022010069_match_signals_durable.sql`  
- Connection request migrations  

No new env required beyond auth + Supabase service role.

## Verify

1. Like someone → durable; no Match until mutual  
2. Mutual → celebration + Matches list with name/photo  
3. Pass → removed from consideration server-side  
4. Connect from Match → request in inbox  
5. Likes you shows inbound interest  

Version **0.81.0**
