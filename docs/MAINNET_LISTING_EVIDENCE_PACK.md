# GreenHaven — Pi Mainnet listing evidence pack

**Rule:** Source readiness ≠ production evidence. Collect live proof before Mainnet listing.

## A. Identity & auth
- [ ] `POST /api/auth/pi` succeeds with sandbox and (later) production API keys
- [ ] `GET /api/identity/me` returns `serverVerified: true` after real Pi sign-in
- [ ] Profile shows **Pi connected** only when server-verified
- [ ] `gh_pi_identities` + `gh_sessions` durable on Supabase (not memory)

## B. Payments (π only for commerce fees)
- [ ] `GHC_PI_ONLY_COMMERCE=1` and `NEXT_PUBLIC_GHC_PI_ONLY_COMMERCE=1`
- [ ] Listing fee: create intent → approve → complete → fulfill (no invented listing)
- [ ] Community create fee: same lifecycle
- [ ] Membership (if sold in π): entitlement only after completed intent
- [ ] Wallet **Payment recovery** lists incomplete/completed-not-fulfilled intents
- [ ] GHC ledger never credited solely from a Pi payment status

## C. GHC as rewards (earn-only under π-only commerce)
- [ ] Daily claim posts durable credit when enabled
- [ ] Referral attribution accepts code / GH-ID / Pi username
- [ ] Referral settlement remains gated by operator flag

## D. Social platform (GreenHaven-owned)
- [ ] Feed, messaging, communities, marketplace operate without Pi social import
- [ ] Media signed URLs for private assets
- [ ] Notifications centre uses GreenHaven events (Pi native notifications: not integrated)

## E. Staking / KYC honesty
- [ ] Staking API returns engagement-only / unavailable until whitelist
- [ ] Account trust signals state PiVerify not integrated
- [ ] No UI claims legal identity from Pi uid

## F. Environment separation
| Variable | Testnet | Mainnet production |
|----------|---------|-------------------|
| `NEXT_PUBLIC_PI_SANDBOX` | `true` | `false` |
| `PI_ENV` | `sandbox` | `production` |
| `PI_API_KEY` | sandbox key | production key |
| `GHC_PI_ONLY_COMMERCE` | `1` | `1` (until policy changes) |
| Withdrawals / A2U / tips | `false` | evidence-gated |

## G. Operator probes
- [ ] `GET /api/pi/platform-capabilities`
- [ ] `GET /api/security/account-signals` (authenticated)
- [ ] `GET /api/payments/recovery/status` (authenticated)
- [ ] Health / system status endpoints green on deployment

## H. Release gate
- [ ] Vercel production build green
- [ ] Migrations applied and validated on target DB
- [ ] Rollback plan documented
