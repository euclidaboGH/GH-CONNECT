# GreenHaven 0.282.0 — Phase 5 Shell Polish & Release Gate

Date: 2026-11-03

## Goal

Production-feeling app shell: honest attention badges, clear navigation to the right inbox, soft refresh on tab intent, cart path retained, phases 1–4 still green.

## Shell / attention
- Attention polls only when session is server-verified; otherwise counts are zero.
- 401/403 responses zero social/economy attention (no sticky red dots).
- `ghc:notifications-read` optimistically clears social attention then re-fetches.
- Home tab re-tap with attention opens notifications (`filter: all`) and soft-refreshes feed.
- Messages re-tap with unread soft-refreshes messages.
- Navigating to Home soft-refreshes feed.
- Badge aria-labels name counts and where to look.

## Commerce nav
- Cart still opens marketplace `bucket: cart` via bottom nav.

## Release gate
- `check-phase5-shell-release-gate.mjs` nests phases 1–4 plus shell contracts.

## Verification
`node scripts/check-phase5-shell-release-gate.mjs`
