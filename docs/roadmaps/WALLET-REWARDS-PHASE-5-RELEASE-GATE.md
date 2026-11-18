# Wallet & Rewards Phase 5 — Release Gate

## Scope

Integrate Phase 1, Phase 2, Phase 3, and Phase 4 of the Wallet & Rewards product track into a single source release gate.

| Phase | Deliverable |
|-------|-------------|
| 1 | Premium wallet home (a11y, rail separation) |
| 2 | GHC asset history search/filters |
| 3 | Rewards transparency (server snapshot, non-zero honesty) |
| 4 | Withdrawal journey (authorize → quote → withdraw; claims on Rewards only) |
| 5 | Deep-link wiring, static contracts, operator checklist, fail-closed flags |

## Deep links

- Rewards **Open Wallet · Withdraw Pi** → `ghc:open-settings-section` `{ section: "wallet", focus: "gh-pi-earnings-tools" }`
- Settings stores focus in `sessionStorage` (`ghc.wallet.focus`); Wallet selects PI rail and scrolls to tools.

## Security

- No Mainnet A2U enablement by default.
- Withdrawal still requires linked identity + active wallet authorization + server eligibility.
- Client never invents balances or marks payouts paid.

## Validation

```bash
npm run check:wallet-phase1
npm run check:wallet-phase2-asset-history
npm run check:wallet-rewards-phase3-transparency
npm run check:wallet-phase4-withdrawal-journey
npm run check:wallet-phase5-release-gate
npm run verify:static
```

Document date: 2026-11-03.
