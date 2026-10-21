# Community chat membership fix — 0.63.15

## Root causes
1. Client treated many community threads as private groups and blocked send when `members` was empty.
2. Join path added social membership without always ensuring the messaging conversation shell.
3. Server create could diverge from client id; UI and chat membership keys must match.
4. Opening a community chat never re-asserted messaging membership.

## Fixes
- kindOf: detect community via kind, isCommunity, communityId, comm_ prefix, board/category.
- evaluateSendPermission: do not hard-block community sends on incomplete local member lists.
- POST create community: prefer stable client id so UI and chat share one key.
- POST join: ensureCommunityConversation then ensureCommunityMember.
- POST /api/messaging/conversations/:id/ensure-member: idempotent membership heal.
- openThread: calls ensure-member for group/community chats.
- createGroup / joinCommunity: stamp members, groupRoles, communityId, then ensure-member.
