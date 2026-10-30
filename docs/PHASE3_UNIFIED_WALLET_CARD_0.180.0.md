# Phase 3 — Unified PI + GHC wallet card

## Implemented in the 0.180.0 working copy

- The wallet hero now contains one combined visual card with distinct PI earnings and GHC utility panels.
- GHC uses the existing official GreenHaven Coin artwork and the existing authoritative GHC wallet snapshot.
- PI earnings are read from the authenticated `/api/economy/earnings/withdrawable` endpoint using `cache: no-store`; the card labels this as the **PI earnings ledger**, not the external Pi Wallet balance.
- PI available and withdrawable amounts are displayed separately. Pending and reserved values are labelled separately where present.
- If the server snapshot is unavailable or invalid, the card displays `Unavailable` and an instruction to refresh rather than inventing a zero balance.
- PI and GHC are never summed or converted into a combined total. Transaction history retains its separate GHC and PI rails.
- Wallet/earnings refresh events trigger PI refresh; existing GHC send/request/receive/activity actions are preserved.
- There is no official Pi coin/logo asset in the source archive, so the panel uses a typographic π mark instead of inventing official artwork.

## Validation

- Unified wallet static contract: 8/8 passed.
- Full network/DB-independent static suite: 56/56 passed, including registration-bonus and unified-wallet contracts.
- TypeScript/build and browser/device checks remain outstanding because the current environment is Node.js 22.16.0 with no installed dependencies. The project requires Node.js 24.15.0.

## Remaining work

- Run the complete build/typecheck in CI using the supported runtime.
- Verify real Testnet balances and UI behavior against the deployed APIs.
- Phase 4 remains responsible for proving the complete Testnet PI withdrawal path, including reserve, A2U transfer, verified receipt, settlement/recovery, and Mainnet denial. A displayed withdrawable balance or fee quote is not proof of an actual payout.
