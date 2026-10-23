# GreenHaven Phase 21 — Activity + Wallet Attribution Convergence

## Scope
Converge GHC wallet ledger history with the social, community, marketplace, transfer, reward and payment surfaces that caused each durable row.

## Implemented
- Added a read-only canonical activity attribution resolver for GHC transactions.
- Resolves post/comment, community, marketplace listing/order, transfer counterparty, reward and payment identifiers from durable ledger metadata.
- Added canonical deep-link navigation for posts/comments, communities, marketplace and profiles.
- Wallet transaction detail now shows linked product activity and durable related identifiers.
- No client credit/debit/reward creation was introduced; attribution is presentation/navigation only.
- Existing wallet ledger remains balance authority.

## Verification
- Phase 21 attribution contract: 12/12 PASS
- Phase 18 community/notification: 13/13 PASS
- Phase 16 cross-surface integrity: 13/13 PASS
- Phase 14 social/economy integration: 11/11 PASS
- Phase 14 wallet bridge: 22/22 PASS
- Social messaging: 15/15 PASS
- Universal search: 41/41 PASS
- Social experience: 35/35 PASS

No production Next.js build/typecheck claim is made here because installed project dependencies/runtime deployment evidence were not available in this workspace.
