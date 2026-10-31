# GreenHaven Community — Global-standard upgrade

## Product model
Communities and realtime chat are deliberately separate. The community is the durable social space (board, updates, discussions, events, members, about/governance). Chat is an optional realtime companion that opens in Messages.

## Chat governance
- Only the canonical community owner can create the community chat.
- Joining a community never silently joins chat.
- Only active community members can request/join chat.
- Owner chooses chat entry policy: `members` (active members opt in immediately) or `approval` (active members request access and wait for owner approval).
- Private/invite-only community membership remains governed by the community join policy before chat is available.
- Messaging's legacy ensure-member endpoint cannot fabricate a community conversation or bypass chat governance.
- Direct client access to chat request rows is denied; privileged RPCs are service-role only.

## UX hierarchy
The community hub retains Board, Updates, Discussion, Events, Members, About and moderator tooling, while reducing chat duplication. Chat membership is presented as an explicit choice and the actual conversation lives in Messages. This prevents the Board from becoming a second messaging screen.

## Release boundary
Migration `20261031010001_gh_community_chat_governance.sql` is source-only until reviewed/applied by the operator. Production remains gated by the project's existing migration and runtime verification process.
