# GreenHaven Social OS Roadmap
## Feed · Discover · Messages · Profile · Create · Matches · Marketplace · Notifications

**Product stance:** Social connection + community + utility economy — **not** “dating app with a wallet.”

Research basis (2025–2026 industry patterns):
- Core five mechanics of durable social apps: **identity, feed, discovery, messaging, moderation**
- Feeds: start chronological/trustworthy; rank only with real engagement data; offer control
- Discovery: explainable reasons > opaque scores; multi-intent (friendship, work, mentoring)
- Notifications: category buckets + **deep links to the exact surface** (never Settings by default)
- Messaging: separate DMs from community spaces; requests vs accepted threads
- Match ≠ Connection: interest/like is not an automatic relationship

---

## Current foundation (already in repo)

| Surface | Strengths | Gaps |
|---------|-----------|------|
| **Home/Feed** | Command centre, daily reward, stories, create hub | Poll UI on cards thin; ranking still simple |
| **Discover** | Multi-object candidates, intents, explainable reasons | Density/filters can go deeper |
| **Messages** | Inbox filters, windowed threads, empty states | Request inbox vs main can be clearer |
| **Profile** | GH ID, hierarchy, communities, create entry | Public vs owner parity needs live QA |
| **Create** | Post+media unified; Story/Poll/Challenge/Community | Story viewer polish; poll vote UX |
| **Matches** | Celebration, connect path | Must never silently become Connection |
| **Marketplace** | Listings shareable to feed | Feed card for listings needs consistent CTA |
| **Notifications** | Buckets + deep-link resolver | Duplicate imports fixed; live QA of every type |
| **Communities** | Full #50–#60 foundation | Operator migrations still pending |

---

## Architecture rule

```
UI action
  → Domain adapter / contract
  → Server API when authoritative
  → Domain event / notification with deep link
  → Social surface router → correct tab/entity
```

Financial rails (GHC / Pi) stay **outside** social content creation.

---

## Phased roadmap

### Phase S0 — Production hygiene (NOW)
- [x] Single create hub vocabulary (post/story/poll/community/challenge)
- [x] Content-kind badges on feed cards
- [x] Notification deep-link center (no Settings dump)
- [x] Fix notification-bell duplicate imports
- [x] Social surface router (`social-surface-router.ts`)
- [ ] Operator: typecheck / lint / build
- [ ] Operator: tap every notification type once in Pi Browser

### Phase S1 — Feed as command centre (next build)
1. Chronological default + optional “Following” / “Communities” filters (honest labels)
2. Native poll options on cards (vote via domain, not text-only detection)
3. Marketplace listing cards in feed with “View listing” → marketplace surface
4. “You’re all caught up” end state
5. Skeleton loaders on first paint (no blank white)

### Phase S2 — Discover quality
1. Sticky multi-select **connection intents** always visible
2. Category rail: People · Communities · Events · Services
3. Explainable reason always on card (min one)
4. Empty states per category with one primary CTA
5. Block/mute respected in every list (already partial)

### Phase S3 — Messages & requests
1. Tabs: **Primary** · **Requests** · **Communities**
2. Community chat entry points open hub Chat tab, not fake DM
3. Icebreakers only when match/connection exists
4. Windowed history + mark read on open (exists; harden)

### Phase S4 — Profile identity
1. Owner vs visitor layouts locked
2. GH ID card component reused everywhere
3. Posts / Communities / Highlights tabs
4. Cover + avatar tap → replace/view actions
5. Never show GHC balance on public profile

### Phase S5 — Create & ephemeral
1. Story ring + viewer (24h) production polish
2. Poll composer → structured poll entity on post
3. Challenge composer → server eligibility only for any GHC
4. One FAB/create hub globally (no duplicate composers)

### Phase S6 — Matches vs Connect
1. Like/Interest ≠ Connection Request
2. Explicit Connect → intent picker → unified request
3. Matches inbox separate from friends

### Phase S7 — Notifications completeness
1. Every emit path sets `data.open` + entity id
2. Buckets: All · Social · Messages · GHC · Rewards · Requests · System
3. Preference toggles (later) without blocking delivery architecture

### Phase S8 — Marketplace ↔ social
1. Share listing → feed post with `listingId`
2. Notification “order/interest” → marketplace deep link
3. Seller profile badge separate from VIP membership

---

## Cross-surface event bus (canonical)

| Event | Purpose |
|-------|---------|
| `ghc:navigate-tab` | Switch main tab |
| `ghc:open-profile` | Profile by userId |
| `ghc:open-conversation` | Messages thread |
| `ghc:open-community` | Community hub |
| `ghc:open-post` | Feed focus post |
| `ghc:open-listing` | Marketplace listing |
| `ghc:open-compose` | Post/story composer |
| `ghc:open-create-hub` | Create sheet |
| `ghc:open-poll` / `ghc:open-challenge` | Specialized composers |

Router: `lib/domains/adapters/social-surface-router.ts`

---

## Success metrics (product, not vanity)

- Time-to-first meaningful post < 2 minutes after onboarding
- Discover cards show ≥1 explainable reason
- Notification tap lands on correct surface ≥ 95% in QA checklist
- Zero Settings redirects for social/GHC taps
- Match flow never auto-friends

---

## Safety & compliance

- No client-minted GHC for likes/comments/posts
- Block/mute enforced on feed, discover, messages suggestions
- Report paths for posts, users, communities
- Adult-only rules already in onboarding age gates — preserve

---

## Execution order recommendation

1. S0 hygiene + router (this pass)
2. S1 feed listing cards + poll structure
3. S3 messages requests split
4. S7 notification emit audit
5. S2 discover density
6. S4 profile visitor parity
7. S5 story viewer
8. S6 matches verification
9. S8 marketplace loop

Do **not** expand marketplace payments or Pi Mainnet in this social track.
