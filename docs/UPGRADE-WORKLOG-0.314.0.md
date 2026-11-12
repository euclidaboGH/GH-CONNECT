# UPGRADE WORKLOG — 0.314.0

**Date:** 2026-11-05

## Source-only verification · Node.js 24.15.0 runtime limitation

Static and source checks do not prove funded Testnet A2U settlement or Mainnet readiness.

## Product change

Exchange-style **Pi withdraw sheet** (not a separate buried “auth card” as the only path):

1. Tap **Withdraw** on the PI rail (or dashboard CTA).
2. Enter **amount** (default = available).
3. **Preview fee** (3% gross; net to linked Pi wallet).
4. **First time only:** checkbox + **Authorize & continue** → `POST /api/identity/wallet-authorization`.
5. Enter short **confirmation code** (first characters of Pi username).
6. **Submit withdrawal** → `POST /api/economy/earnings/withdrawals`.

A full separate withdrawal PIN vault can follow in a later security phase; this release adds a professional confirm step without inventing client-side money movement.

## Security non-changes

- Explicit consent still required.
- Recipient still from `gh_pi_identities` only.
- No bulk authorize, no Mainnet enablement.
- Execution remains flag- and funding-gated after the request is accepted.
