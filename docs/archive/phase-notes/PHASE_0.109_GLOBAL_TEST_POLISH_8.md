# GreenHaven 0.109.0 — Eight-phase polish for global testing

Scope: feed, profile, wallet, rewards, marketplace, community, membership, cross-section release hygiene.

## Phase 1 — Feed
- Keep CollapsingAppHeader + pull-to-refresh + EmptyState / PostSkeleton paths.
- Engagement remains server-authoritative (no optimistic durable success).
- Daily claim stays off the feed header (golden GHC coin + lightning FAB only).

## Phase 2 — Profile
- Slim sticky profile header and sub-sheet headers for content space.
- Section tabs (Posts / Media / Listings / Communities / About) unchanged.
- Media still resolves via durable signed-url path.

## Phase 3 — Wallet
- Compact header (prior 0.108.2).
- Social economy banner removed from wallet chrome.
- Focus / visibility / claim events trigger wallet revalidation so pending→available does not require logout.
- Dual-rail honesty retained (π separate from ₲).

## Phase 4 — Rewards
- Available/Pending/Locked strip removed from Rewards chrome (balances live in Wallet).
- Compact Rewards header.
- Journey, streak, missions remain the primary content.

## Phase 5 — Marketplace
- Dual-rail listing fee (GHC / Pi) with honest GH Pay completion for π.
- Economy refresh events after durable create/edit so wallet pending/spend updates without logout.
- Listing fees remain non-refundable platform charges.

## Phase 6 — Community
- Header density reduced where thick chrome was present.
- Create-group dual-rail fees remain server-settled (no pretend GHC settlement for unpaid Pi).

## Phase 7 — Membership
- Slim page header.
- Activate / reconcile emit membership + wallet events.
- Pi vs GHC rails stay separated; entitlement is server-side.

## Phase 8 — Cross-section gate
- Shared `PageChrome` component for secondary screens.
- Daily claim FAB: official gold GHC coin + lightning aura on every screen.
- Static contract: no Social economy banner in wallet chrome; no balance strip in rewards chrome.

## Operator notes for global test
- Enable testnet economy flags already documented (`GHC_TESTNET_UNLOCK`, pack/buy-with-pi, fee amounts).
- Keep withdrawals / A2U / tips gated off until mainnet policy review.
- Verify Node 24 build on Vercel Testnet before broad invite.

## Continuation — 0.110.0

### Rewards journey
- Available tile now prefers `useWalletRead().snapshot.availableGhc` (not a stale domain store 0.00).
- Listens for `ghc:wallet-synced`, `ghc:wallet-refresh`, `ghc:daily-reward-claimed` to re-render without logout.

### Marketplace checkout
- Emits economy refresh after order create and after successful GHC pay so wallet spends appear without logout.

### Shared events
- `lib/ghc-app-events.ts` catalogs canonical CustomEvent names for secondary screens and operators.
