# 0.139.0 — Daily claim FAB + wallet history

## Daily claim (Pi-style)
- `DailyClaimPrompt` renders via `createPortal(document.body)` so nothing clips the FAB.
- Mid-right at 42% viewport height; z-index 9999 / sheet 10000.
- Auto-opens claim sheet once per Lagos day when server `claimable === true`.
- FAB stays until `claimedToday`; no header banners.

## Wallet
- History action opens a full-screen sheet with GHC ledger and π payments tabs.

## Profile
- Ecosystem hub uses server `greenHavenId` so Copy ID and Verified Pioneer match.
