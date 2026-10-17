# GreenHaven — Multi-user production roadmap (10 phases)

In-house test findings (≈10 Pi KYC users, multi-device, multi-location):

| Symptom | Root cause (codebase) |
|---------|------------------------|
| Posts not visible to other users | Feed hydrate required `feed.durable && posts.length`; local domain posts never reach other clients without Supabase social RPCs + env |
| Friend/connect not received | `friendRequests` persisted in **device** Pi SDK state; API `/api/connections/*` existed but was not always called |
| Follow/match not cross-account | Graph toggles were local-first; `/api/social/follows` not always confirmed |
| VIP users still isolated | Membership does not replace social durability — same feed/graph spine |

## Operator prerequisites (must be true for cross-user)
1. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or project env used by `readGhcServerEnv`)
2. Social migrations / RPCs: `gh_post_list_feed`, post create, reactions, comments, follows, connection request
3. Auth: `resolveAuthenticatedUser` must resolve **stable Pi-linked user ids** per account
4. Clients must send `IdentityService.getAuthHeaders()` on social calls

---

## Phase 1 — Social spine: durable hydrate + graph write-through (THIS PHASE)
- Merge feed/stories when API returns posts (not only `durable`)
- `addFriend` → `socialConnectionRequest`
- `followUser` → `socialFollow`
- Honest toasts when server not confirmed
- Roadmap + diagnostics notes

## Phase 2 — Feed authority & post visibility — DONE
- Map remote post shape fully (engagement, community, media)
- Force re-fetch after publish; soft-poll feed on focus
- Visibility filters public/followers on server (server RPC + client mapper)

## Phase 3 — Comments, reactions, engagement bus — DONE
- Dual-write comment/reaction + engagement bus likeCount
- loadPostComments for shared posts[] (feed + profile)
- Comment sheet hydrates on open

## Phase 4 — Connections inbox (incoming/outgoing) — DONE
- GET list pending; hydrate friendRequests; inbox merges server+session
- accept/decline dual-write; profile.id preferred for direction filters

## Phase 5 — Discover / Match durability — DONE
- ghc_match_signals migration + signal/inbox APIs
- swipe dual-write; mutual from server; hydrate likes/matches
- Honest toasts when non-durable

## Phase 6 — Messaging multi-device
- Conversation list + messages from durable messaging APIs
- Offline flush already present — confirm senderId + auth

## Phase 7 — Profile & identity consistency
- Author hydrate; avatar/cover durable URLs; GH ID single source

## Phase 8 — Rewards / GHC / Pi payment rails
- Daily claim state server-authoritative; Pi SDK completion webhooks

## Phase 9 — Membership VIP/VVIP entitlements
- Server-gated features; no client-only VIP content access

## Phase 10 — E2E multi-user gate + release — DONE (docs + checklist)
- See docs/PHASE10_MULTIUSER_RELEASE_GATE.md
- Client dual-write Phases 1–9 complete; live E2E is operator-signed

---

**Phase 1 does not invent users or posts.** It wires existing APIs and stops silently isolating social graph on one device.

## Phase 6 — Messaging multi-device — DONE
- Dual-write create/send; loadConversationMessages; offline flush durable path



## Multi-user client status 2026-10-17

Phases 1–9 client wiring complete. Phase 10 release gate documented. Live Testnet multi-user remains operator verification.
