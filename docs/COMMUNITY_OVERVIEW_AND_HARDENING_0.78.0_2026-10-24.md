# Community section — overview, wiring & hardening 0.78.0

## Architecture overview

```
UI
├── communities-screen.tsx     My | Discover directory + Create modal + Join gate
├── premium-community-hub.tsx  Board / Chat / About / Members / Events
├── create-group-modal.tsx     Multi-step create + dual-rail fee + durable cover
├── group-card.tsx             List cards (LazyImage covers)
├── profile-my-communities.tsx Profile grid → ghc:open-community
└── community-*-ui adapters    Join reasons, roles labels, empty states

Domain
├── community-domain.ts        Local mutations, board posts, events, roles
├── community-persistence.ts   Offline conversation mirror
└── adapters/*                 Membership authority, notifications, governance

Server
├── POST/GET /api/communities
├── POST/DELETE /api/communities/:id/join
├── POST /api/communities/:id/requests
├── POST /api/communities/:id/roles
├── GET/POST /api/communities/:id/platform
├── GET /api/communities/create-fee
└── ensureCommunityConversation / ensureCommunityMember (messaging)

Economy
└── quoteCommunityCreateFee + settlePilotFee (GHC or Pi)
```

## Cross-feature connections

| Feature | Connection |
|---------|------------|
| Messaging | Community id = conversation id; join/approve → `ensureCommunityMember` |
| Wallet / fees | Create settles GHC or Pi via pilot fee policy |
| Media | Durable cover upload; hub + cards + profile use LazyImage / resolveDisplayUrl |
| Notifications | Community bucket + invite/join/announcement subtypes |
| Profile | My Communities list; open → communities tab |
| Marketplace | Suggested communities on listing detail (existing) |
| Identity | Session user only for create/join/roles (no client owner injection) |

## Hardening in 0.78.0

1. **Join no longer promotes joiner to conversation owner** — only `ensureCommunityMember(role=member)`.
2. **Join request approve** also attaches chat membership for applicant.
3. **Directory hydrate** maps cover, memberCount, tags, rules, welcomeMessage.
4. **Client helpers** for platform get/action and set role.
5. **Profile covers** use LazyImage (private media safe).

## Prior 0.77.0 (carried)

- Durable cover on create; dual-rail fee CTA; hub resolved cover; create-fee API.

## Env

| Variable | Privacy |
|----------|---------|
| `GHC_COMMUNITY_CREATE_FEE_GHC` / `_PI` | Private |
| `NEXT_PUBLIC_GHC_COMMUNITY_CREATE_FEE_GHC` / `_PI` | Public |
| `GHC_TESTNET_UNLOCK` | Private |
| Supabase service role + URL | Private |

## Migrations (already required)

- `20261022010033_gh_communities_core.sql`
- `20261023030001_gh_community_platform_v2.sql`

No new migration in 0.78.0.

## Verify

1. Create with cover + fee rail → Discover + hub show cover  
2. Other user joins public → can open Chat without FORBIDDEN  
3. Private request → approve → applicant can Chat  
4. Profile My Communities → opens hub  
5. Owner sets moderator via roles API  

Version **0.78.0**
