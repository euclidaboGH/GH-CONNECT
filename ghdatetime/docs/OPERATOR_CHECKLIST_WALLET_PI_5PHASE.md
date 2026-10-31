# Operator checklist — Wallet PI claim & withdraw (5 phases)

Use on **Pi Testnet** only until a separate Mainnet gate exists.

## A. Database
- [ ] Apply `20261030010001_registration_bonus_v2_reconciliation.sql`
- [ ] Confirm RPCs: `gh_earnings_registration_bonus_status`, `gh_earnings_registration_bonus_claim` (service_role)
- [ ] Confirm withdraw RPCs / payout request tables from prior earnings migrations

## B. Environment
```
GHC_REGISTRATION_BONUS_ENABLED=1
NEXT_PUBLIC_PI_SANDBOX=true
PI_NETWORK=testnet
# After funding + identity checks:
PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true
# Worker only:
PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=true
PI_A2U_ENABLED=true
PI_A2U_TESTNET_ONLY=1
```
- [ ] Redeploy after env change
- [ ] Never commit real `PI_API_KEY` / wallet seed to git

## C. Registration bonus proof
- [ ] New user claims **3 π** once
- [ ] Legacy 0.05 π user claims **2.95 π** top-up (auto or CTA)
- [ ] SQL: `unique_ref like 'registration_bonus:%'` totals **3 π** atomic sum for that user

## D. Withdraw proof
- [ ] Withdrawable ≥ min payout
- [ ] Linked Pi identity visible in quote destination
- [ ] Preview shows gross − 3% = net
- [ ] Request returns `transferSubmitted: false` and request id
- [ ] Execute worker marks paid only after provider receipt
- [ ] Duplicate execute is idempotent

## E. Rollback / pause
- [ ] Set `GHC_REGISTRATION_BONUS_ENABLED=0` to pause new claims
- [ ] Set `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=0` to stop new requests
- [ ] Execution flags off stops A2U without deleting reservations
