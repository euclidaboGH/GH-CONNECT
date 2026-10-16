# Discover section audit (2026-10-11)

## Critical gap fixed

**Modern Connection cards lacked Like/Pass** while classic UserCard had them.
Matching interest is now offered on ConnectionCard via `like` / `pass` actions
wired to existing `ghc.swipe` paths (no invented matches).

## Other fixes

- `ConnectionCardAction` extended with `like` | `pass`
- Eligible actions for none/suggested/declined include Like + Pass + Connect
- `onCardAction` handles like/pass
- BusinessesSection no longer lists fabricated shops
- Dual card modes retained (Connection cards default; Photo cards = UserCard)

## Canonical surface

`DiscoveryGridScreen` → `DiscoveryObjectCard` / `ConnectionCard` / `UserCard`

## Safety

- No manufactured candidates
- Like ≠ connection request
- Pass uses existing swipe API
