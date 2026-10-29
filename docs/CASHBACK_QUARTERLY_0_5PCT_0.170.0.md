# Pi cashback policy — 0.5% quarterly (0.170.0)

## Product rule
- **Rate:** **0.5%** (50 bps) of **eligible PI spend** attributed to the user
- **Cadence:** **Quarterly** UTC windows  
  - Q1: 1 Jan – 1 Apr  
  - Q2: 1 Apr – 1 Jul  
  - Q3: 1 Jul – 1 Oct  
  - Q4: 1 Oct – 1 Jan (next year)
- **Grace:** 7 days after quarter end before period close is allowed
- **Claim:** After entitlement is calculated, via existing Testnet A2U claim path

## Spend base
Sum of `gross_amount_minor` on verified, `cashback_eligible` PI revenue events for the paying user (purchases positive; refunds/chargebacks negative). Cashback is floored at 0.

## Migration
`20261029010013_pi_cashback_quarterly_0_5pct.sql`

## Not claimed
Remote migration applied, funded A2U receipt, Mainnet.
