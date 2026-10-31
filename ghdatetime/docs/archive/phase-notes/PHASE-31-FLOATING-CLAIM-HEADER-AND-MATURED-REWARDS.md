# Phase 31 — Floating Daily Claim, Compact Header, and Mature Reward Settlement

**Release:** v0.91.4  
**Status:** source-level fixes and static contracts pass; not approved for production until migration review/application and authenticated Testnet verification.

## UI corrections

- Removed the app-shell top-right notification overlay so it no longer sits above the brand/header row.
- Added the lazy-loaded notification bell after Marketplace and Ecosystem in the shared header actions. The bell uses a compact gold treatment and retains its unread count/accessibility behavior.
- Changed the daily claim from an auto-opening first-entry popup to a floating gold lightning action. It sits above the bottom navigation, does not consume header/content layout space, and keeps pointer events isolated so the feed remains usable behind it. The claim dialog opens only when the user taps the action or an explicit in-app action requests it.
- Added a restrained GreenHaven logo blink to actual tab-loading fallbacks. It is sized as a compact loading mark and respects `prefers-reduced-motion`; ordinary content and idle pages do not blink.

## Durable reward settlement

- Added authenticated `POST /api/economy/rewards/claim-matured`. It lists only the current authenticated user's positive, pending `DAILY_CLAIM_V12` transactions older than the 48-hour cutoff, skips review-required holds, and settles through the existing `ghc_claim_pending` RPC.
- The database RPC remains the authority for ownership, claim metadata, review status, the 48-hour lock, and idempotency. The endpoint does not accept a user ID or amount from the browser. It returns a refreshed server snapshot; the wallet refreshes its authoritative read after reconciliation.
- Added `rpcListMaturedDailyClaimHolds` so the reconciliation queries only matching pending Daily Claim rows rather than scanning a capped list of all transactions. A bounded batch avoids an unbounded request.
- Added migration `20261025090001_backfill_daily_claim_48h_metadata.sql`. It only fills missing claim metadata on positive pending `DAILY_CLAIM_V12` rows that are not marked for review. It does not change amounts, owners, timestamps, or statuses. This migration is classified `REVIEW_REQUIRED` and must be inspected and tested on Testnet before application.

## Validation

- Phase 31 contract: 14/14 passed.
- Daily reward UX contract: 15/15 passed.
- Notification center contract: 10/10 passed.
- Registered static suite: 15/15 passed.
- Project truth: 10/10; release hygiene: 11/11; production safety: 21 passed / 0 failed; JSX safety: 773 files scanned; dependency lock and migration inventory checks passed.
- Database source inventory: 133 migration files and 114 executable GreenHaven tables. These are repository counts, not proof of applied database migrations.

## Remaining release gates

- Apply the new metadata backfill only after reviewing the exact Testnet rows and reconciling remote migration history.
- Run full `tsc --noEmit` and the production Next.js build with the supported Node `24.15.0+` runtime and installed locked dependencies. The available runtime in this environment is Node 22, so those checks are not claimed here.
- Validate with authenticated Testnet accounts: an under-48-hour hold remains pending; a hold beyond 48 hours settles once; repeated/concurrent reconciliation does not duplicate credits; available balance increases only after the durable ledger posts; send/spend uses that updated available balance; review-required rows remain locked.
- Confirm the floating action is visually clear above the bottom navigation on small Android viewports, including safe-area insets and reduced-motion settings.


## v0.91.4 visual refinement — compact GHC claim popover

- Replaced the generic lightning FAB with the official round gold GHC coin asset.
- Added a restrained gold aura and three staggered lightning flashes around the coin; the coin itself gently floats. All animation is disabled when the user prefers reduced motion.
- Replaced the full-screen modal/backdrop with a small non-modal popover anchored above the bottom navigation. It overlays content without reserving page space or dimming/locking the feed.
- Added short user-facing copy explaining daily check-in, streak continuity, server verification, and the 48-hour hold; included clear claim/loading/retry/success states and wallet/history actions.
- Reward logic, server eligibility, idempotency, and wallet authority are unchanged by this presentation-only refinement.
