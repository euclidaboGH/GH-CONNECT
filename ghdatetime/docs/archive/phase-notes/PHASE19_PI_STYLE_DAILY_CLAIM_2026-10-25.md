# Phase 19 — Pi-style daily GHC claim (0.108.0)

## UX (aligned with Pi mining video)

1. **Floating purple lightning FAB** — fixed above bottom nav on every screen; does **not** push page headers.
2. **Tap opens confirmation sheet** (like “Mine by confirming circle”) with preview amount, cycle day, contribution note.
3. **Claim GHC** primary button runs `postDailyClaim` (server authoritative).
4. Success state shows amount + pending maturity; FAB hides for the day after claim.
5. **Open Rewards details** deep-links to rewards centre.
6. Session hint: “Tap to claim GHC!” once when claimable.

## Preserved

- Idempotent server claim; no client mint
- Wallet sync after claim via existing adapters
- Events: `ghc:daily-reward-claimed`, `ghc:wallet-refresh`, `ghc:wallet-synced`
