# Section refresh hardening (0.178.0)

## Problem
Refresh logic was uneven and sometimes harmful: marketplace listing cards each subscribed to `visibilitychange`/`online` and stampeded `ghc:marketplace-refresh`. Communities emitted `ghc:communities-refresh` on visibility but nothing reloaded the directory. Focus/visibility reload patterns were duplicated without shared coalescing.

## Solution
- `lib/client/section-refresh.ts` — `emitSectionRefresh`, `attachSoftRefresh`, `createAsyncRefreshGate`
- `hooks/use-section-refresh.ts` — screen-level soft refresh (never per row)
- Marketplace: single screen gate; **ListingCard listeners removed**
- Communities: soft refresh bumps `directoryTick` and re-fetches directory
- Feed: manual pull/button emits canonical `ghc:feed-refresh`

## Policy
- Soft refresh min interval ~12–15s (focus/visibility/online)
- Manual refresh is not throttled the same way (feed emit minInterval 0)
- Concurrent loads coalesce where gates are used
