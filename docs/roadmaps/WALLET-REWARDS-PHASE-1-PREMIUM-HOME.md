# Wallet & Rewards Roadmap — Phase 1: Premium Home

## Scope
- Clarify wallet title and Pi/GHC separation.
- Improve the accessible asset selector semantics and visible keyboard focus.
- Keep balance privacy, existing data providers, refresh behavior, withdrawal eligibility checks and financial handlers unchanged.
- Avoid announcing the entire balance card on every update; dynamic network status remains announced in its own status region.
- Register a focused static regression check in `prebuild` and `verify:static`.

## Safety boundaries
- No database migrations or runtime dependencies added.
- No financial calculations, wallet APIs, withdrawal rules, Pi payment handlers, ledger RPCs or authorization policy changed.
- The client remains a display surface; authoritative balances and transaction eligibility remain server-governed.

## Required release validation
- Run under the repository's pinned Node version (`.nvmrc`).
- Run `npm ci --legacy-peer-deps`, `npm run check:wallet-phase1`, `npm run verify:static`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- Verify wallet home, Pi/GHC selection, balance masking, offline/stale states, screen reader announcements and keyboard navigation on Android/Pi Browser and desktop.
- Test financial actions only in a non-production environment before release.

Document date: 2026-11-03.
