# Human Connection OS Foundation (Prompt #36)

Strangler-fig layer introduced beside the existing GH-CONNECT application.

## Domain boundaries

| Domain | Contract path | Authority notes |
|--------|---------------|-----------------|
| Identity / Profile | `lib/domains/contracts/identity.ts` | IdentityService + profile session |
| Connections | `lib/domains/contracts/connections.ts` | Graph relations — not GHC |
| Discovery | `lib/domains/contracts/discovery.ts` | Explainable reasons only |
| Feed | `lib/domains/contracts/feed.ts` | Post presentation |
| Messaging | `lib/domains/contracts/messaging.ts` | Private / group threads |
| Communities | `lib/domains/contracts/communities.ts` | Belonging + board |
| Activities | `lib/domains/contracts/activities.ts` | Events / meetups |
| Notifications | `lib/domains/contracts/notifications.ts` | Deep-link buckets |
| Reputation | `lib/domains/contracts/reputation.ts` | **Not GHC** |
| Search | `lib/domains/contracts/search.ts` | People / posts / GH ID |

Protected (unchanged authority): economy, wallet, membership, Pi payments, rewards ledger.

## GHC context extraction seams

`lib/domains/adapters/ghc-context-seams.ts` maps mega-context slices to contracts without deleting `contexts/ghc-context.tsx`.

Order: Identity → Connections → Discovery → Feed → Messaging.

## Shell

Primary bottom nav remains: **Home · Discover · Create · Messages · Profile**.

Secondary surfaces (matches, communities, wallet, settings) stay reachable via existing events/routes.

## Home command centre

`components/ghc/home-command-centre.tsx` — greeting, daily reward, network/messages/discover overview with honest empty states.

## Connection intents

Extended options: professional, learning, volunteering, events (plus existing friendship, dating, networking, business, collaboration, communities, mentorship).

## Safety

- No production seed people/communities injected by new contracts.
- No financial constant or Pi authority changes in this prompt.
