# Harden pass — 2026-10-20 (0.63.6)

## Error / type hardening
- Profile story upload errors use `uploaded.ok === false` before reading `userMessage`
- Connection / accept notification types map to Matches + inbox deep links
- `connection_accept` routes to Matches (not pending inbox)

## Wiring added
- `first_comment` mission progress after durable top-level comment
- `accept_connection` mission progress after durable accept
- Online event rehydrates connection inbox + emits social-mutation for surfaces that listen

## Still operator-side
- Live two-account E2E, migration apply, Vercel typecheck under full install
