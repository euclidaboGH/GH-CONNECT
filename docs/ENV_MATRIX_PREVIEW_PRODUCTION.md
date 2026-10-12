# Preview vs Production environment matrix

**Secrets never go in git.** Configure only in Vercel (or your secret store).

| Variable | Preview / Testnet | Production | Notes |
|----------|-------------------|------------|--------|
| `NEXT_PUBLIC_PI_SANDBOX` | `true` | `false` | Must match Pi portal network |
| `PI_API_KEY` | Testnet / Develop key | Mainnet key | Server-only |
| `NEXT_PUBLIC_PI_CLIENT_ID` | Preview app id | Production app id | Public |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Testnet project | Prod project | |
| `SUPABASE_SERVICE_ROLE_KEY` | Testnet service role | Prod service role | Server-only — never `NEXT_PUBLIC_` |
| `DOMAIN_VALIDATION_KEY` | Preview domain key | Prod domain key | Pi domain validation |
| `GH_SETTLEMENT_INTERNAL_KEY` | Testnet settlement | Prod settlement | System-only routes |
| `NEXT_PUBLIC_MESSAGING_DURABLE` | `0` until IDOR green | `1` only after gates | |
| `GHC_ALLOW_DEV_AUTH` | optional local only | **unset / 0** | Production readiness fails if set |
| `GHC_ENV` / `VERCEL_ENV` | preview | production | Drives fail-closed identity |

## Network labels

- Sandbox: `piInitSandbox: true` → Testnet portal + Testnet API key  
- Mainnet: `piInitSandbox: false` → real π, irreversible payments  

## Readiness

- Liveness: `GET /api/health/live` (always 200 if process up)  
- Release gate: `GET /api/health` → **503** in production when critical blockers (Pi client id, API key, durable identity/session, Supabase) fail  

See `lib/server/readiness.ts` and `SAFE_TO_PUSH.md`.
