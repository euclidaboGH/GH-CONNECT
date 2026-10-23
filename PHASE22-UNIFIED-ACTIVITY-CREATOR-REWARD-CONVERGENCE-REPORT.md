# GreenHaven Phase 22 — Unified Activity, Creator & Reward Convergence

## Scope
Phase 22 converges previously separate Profile Dashboard, Creator Studio, Rewards Centre and Wallet attribution into a shared read-only activity model. It does not create GHC, change balances, or bypass server-authoritative ledger/reward rules.

## Delivered
- Added `UnifiedActivityCenter`, backed by canonical economy transactions and reward records.
- Added filters for social, community, marketplace, rewards and transfers.
- Added event-driven refresh for wallet, curation, post engagement and reward claims.
- Deduplicates reward rows already represented by correlated ledger entries.
- Reuses the Phase 21 durable attribution resolver and canonical cross-surface navigation.
- Embedded Activity Center in Profile Dashboard and Creator Studio.
- Rewards Centre history can deep-link supported social/community/marketplace reward records back to source activity.
- Added marketplace order fallback attribution from stable `market_order_<id>` references when legacy ledger metadata does not carry `orderId`.
- Preserved fail-closed/read-only accounting semantics: UI attribution never creates rewards or modifies the ledger.

## Verification
- Phase 22 unified activity contract: 17/17 PASS.
- Phase 21 activity/wallet attribution regression: 12/12 PASS.
- Phase 18 community/notification regression: 13/13 PASS.
- Phase 16 cross-surface integrity regression: 13/13 PASS.
- Production Next.js typecheck/build was not claimed because `node_modules` is absent in this workspace.

## Remaining runtime validation
Run the normal dependency install and production CI/build gates in the project/Vercel environment before deployment. Validate real ledger metadata from marketplace, creator tips, Pi payments and community activity against the new source-navigation surfaces.
