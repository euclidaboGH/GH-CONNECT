# Community authority consolidation (Step 1)

## Rule

| Concern | Production | Studio / demo |
|---------|------------|---------------|
| Membership (`isJoined`) | Domain row only (`resolveMembershipState` / members / owner) | Domain + optional `localJoined` hydrate cache |
| Board posts | Domain `createBoardPost` only; failure → error toast | Domain first; local board only if domain missing/fails |
| Leave | Domain `leaveCommunity` success required | Cache-only leave if no API |
| Create group | Domain id required | May mirror id into `localJoined` for list hydrate |

## Class D keys (not production truth)

- `ghc.community.joinedIds`
- `ghc.community.boardPosts`
- `ghc.communities.conversations.v2` (persistence module)

## Helpers

`lib/domains/adapters/community-ui-authority.ts`

- `isCommunityMemberDomain`
- `isCommunityMemberWithOptionalCache`
- `allowLocalBoardFallback` / `communityLocalCacheAllowed`
