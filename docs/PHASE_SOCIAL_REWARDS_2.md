# Phase 2 — Share-to-community, board durability, chat membership (2026-10-20)

## Changes
1. **Share → Communities** — Share sheet lists only conversations the user has joined; empty state points to join; uses `shareToCommunities` (membership-filtered).
2. **Share service** — `isConversationMember` / `isCommunityConversation`; group share refuses non-members.
3. **Community chat gate** — messaging domain requires membership for COMMUNITY and PRIVATE_GROUP even when `members[]` is empty/unhydrated.
4. **Board posts** — `createBoardPost` is server-first via `socialCreatePost({ communityId })`; local board mirrors durable id; NOT_A_MEMBER surfaces clearly.
5. **Board authorize** — domain checks members **or** groupRoles **or** owner.
6. **Communities UI** — joined detection includes `members[]`.

## Safety
- No ledger / payment / RLS changes
- No invented balances
- Share still reference-only (does not clone post content as a new public post except community-scoped durable board via createPost API)
