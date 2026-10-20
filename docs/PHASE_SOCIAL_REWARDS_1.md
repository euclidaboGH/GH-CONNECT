# Phase 1 — Social + Mission + Membership fixes (2026-10-20)

## Fixes
1. **Community membership / post gate** — `roleOf` treats `members[]` as member even without `groupRoles`; join mutation writes both members and `groupRoles[user]=member`.
2. **Mission progress API** — `POST /api/economy/missions/progress` for join_community, first_post, first_comment, complete_profile, send_connection, accept_connection.
3. **Mission wiring** — after durable join, durable first post, friend request, friend accept.
4. **Discover** — lists all `gh_user_profiles` (not only onboarded=true); returns interests for filters.
5. **Messages** — soft poll open conversation every 8s while tab visible.

## Operator flag
- `GHC_ACTIVITY_REWARDS_ENABLED=1` — credits small GHC via activity emission for missions (server caps still apply).
- Without the flag: missions still complete for UX; message explains GHC remains locked.

## Not inventing balances
No client-side GHC mint. Wallet only changes when durable emission succeeds.

## Next phases
- Phase 2: share-to-community from feed, board post pipeline, community chat durability
- Phase 3: connection inbox E2E + match mutual
- Phase 4: comment/reaction cross-account roster + realtime bus
- Phase 5: full 20 essentials packaging + operator evidence
