# GreenHaven — Pi runtime + auth lifecycle

## Pi runtime (`lib/pi-runtime.ts`)

Single client source of truth for:

| Concern | API |
|---------|-----|
| Sandbox vs mainnet | `getPiSandbox()` / `getPiNetworkMode()` via `lib/pi-env` |
| SDK init once | `ensurePiInitialized()` |
| Official authenticate | `piAuthenticateOfficial()` |
| Snapshot / probes | `getPiRuntimeSnapshot()` |

**Rules**

- Preview / localhost → sandbox (Testnet)
- Production host → mainnet unless `NEXT_PUBLIC_PI_SANDBOX` overrides
- Never expose `PI_API_KEY` or wallet seeds
- Client uid is **not** final identity — always `POST /api/auth/pi`

Consumers updated: `pi-auth-context` (official auth), `pi-u2a-payment` (init + sandbox probe).

## Auth lifecycle (`lib/auth/auth-lifecycle.ts`)

Phases: BOOTING → … → SERVER_VERIFYING → SESSION_READY → ONBOARDING_STATUS_RESOLVED → READY | ERROR

Onboarding status: **`unknown` | `required` | `complete`**  
(never assume `false` while loading)

App shell (`components/ghc/app.tsx`):

- `unknown` → loading shell (no registration flash)
- `required` → Onboarding
- `complete` → main app

## Tests to run in Pi Browser (manual)

1. Auth success → server verify → READY  
2. Cancel auth  
3. Incomplete payment recovery toast  
4. Payment success / fail / retry  
5. Returning user: no onboarding form  
6. New user: onboarding after server says required  
7. Non-Pi browser: local preview only if allowed  
8. Preview vs Production sandbox alignment via `/api/health`
