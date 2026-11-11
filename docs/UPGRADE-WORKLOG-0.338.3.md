# UPGRADE WORKLOG 0.338.3

## TypeScript / build repair
- Discriminated-union narrowing for GHC spend RPC via typed spend-rpc-contract.ts wrapper
- Wallet transfer direction narrowed to incoming|outgoing
- Communities: remove duplicate directoryOffset state; attention filter toggles use explicit values
- Feed: Profile uses id only (no userId)
- Rewards: mission unlocks bind durableMissionIds from server achievements before challenge cards
- Messaging: unmute sets muteUntil undefined (not null)
- Wallet: section refresh returns void (no false)
- Reward challenges: ctaHint includes connections

## Verification boundary
This release uses source-only verification (source-level static gates and isolated helper tests).
Supported build runtime: Node.js 24.15.0

Production remains NOT APPROVED.
