# Upgrade worklog — 0.210.0

## Phase 3 complete — PI claim buttons

- Professional full-width registration bonus CTA on Wallet (gradient when claimable).
- Rewards uses compact claim card / claimed chip.
- Legacy auto-reconcile + manual **Claim remaining 2.95 π**.
- New users **Claim 3 π now**.
- Events: `ghc:wallet-refresh`, `ghc:earnings-refresh`, `ghc:toast`.
- Doc: `docs/PHASE3_PI_CLAIM_BUTTONS.md`
- Contract: `check:phase3-pi-claim-buttons`

## Source-only verification
- Network/DB independent static contracts only (source-level).
- Supported runtime: **Node.js 24.15.0**.
- Live credit still requires Phase 1 operator migration + Testnet flags.
