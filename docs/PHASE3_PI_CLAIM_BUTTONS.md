# Phase 3 — PI claiming buttons

## Goal
Claimable users complete **3 π** (or **2.95 π** legacy top-up) via clear Wallet/Rewards CTAs without per-user operator SQL.

## Surfaces
| Surface | Behavior |
|---------|----------|
| Wallet | Full `RegistrationBonusCard` — gradient highlight when claimable; full-width primary CTA |
| Rewards | `RegistrationBonusCard compact` — chip when claimed; same claim path |
| Legacy | Auto-reconcile on load when claimable + manual **Claim remaining 2.95 π** |
| New user | **Claim 3 π now** |

## Events after successful claim
- `ghc:wallet-refresh`
- `ghc:earnings-refresh`
- `ghc:toast` (success)

## Server authority
- `GET/POST /api/economy/earnings/registration-bonus`
- Body ignored — amount from policy + ledger only
- Requires `GHC_REGISTRATION_BONUS_ENABLED=1` + `NEXT_PUBLIC_PI_SANDBOX=true`
- Migration `20261030010001_registration_bonus_v2_reconciliation.sql` must be applied

## Acceptance
- [ ] Claimable legacy user sees full-width remaining CTA on Wallet
- [ ] Claim posts no client-chosen amount
- [ ] Success refreshes wallet + earnings and shows toast
- [ ] Rewards uses compact card (no duplicate full dashboard)
- [ ] Migration-pending state is visible when enabled but RPC missing
- [ ] `check:phase3-pi-claim-buttons` passes

## Limits
Does not enable A2U withdrawal (Phase 4). Does not invent balances.
