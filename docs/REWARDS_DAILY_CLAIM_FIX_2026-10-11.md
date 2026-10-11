# Daily claim claimed-state fix (2026-10-11)

## Problem
Server claim succeeded (or already claimed) but local `getDailyStreak().canClaimToday` stayed true, so the CTA remained green.

## Fix
After successful `/api/economy/rewards/daily` (including alreadyClaimed / idempotent), call `claimDailyStreak` to mark `lastClaimDayKey` for today.
Same on error responses that indicate already claimed.

## UI
When `!canClaimToday`, show muted **Claimed today** status row (not a green claim button).
