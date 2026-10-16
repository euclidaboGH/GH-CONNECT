# Phase 3 — Daily claim + wallet truth

## Done
- `msUntilNextLagosMidnight` + `formatCountdown` (Africa/Lagos)
- `markDailyClaimedForUi` when server confirms claim / already claimed
- Rewards journey: green Claim only when `canClaimToday`; else claimed card + live countdown
- Feed daily card: claimed strip + countdown (not green CTA)
- Wallet statement lines use ₲ via formatGhc

## Not changed
- Economy/ledger claim RPCs
- Reward amounts (server still authoritative)
