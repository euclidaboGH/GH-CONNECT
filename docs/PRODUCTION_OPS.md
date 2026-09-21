# Production ops (env + gates)

## Required env names (values never in git)

| Name | Scope |
|------|--------|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Server + public URL only |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never `NEXT_PUBLIC_*` |
| `NEXT_PUBLIC_PI_CLIENT_ID` | Public OAuth client id |
| `PI_API_KEY` | **Server only** |
| `NEXT_PUBLIC_PI_SANDBOX` | Optional; must match portal network |

## Optional

| Name | Purpose |
|------|---------|
| `NEXT_PUBLIC_MESSAGING_DURABLE=1` | Client uses durable messaging APIs |
| `GHC_ALLOW_DEV_AUTH` | **Must be unset/false in Production** |
| `GHC_SERVER_MEMORY` | **Must be unset/false in Production** |

## Release gate

1. `npm run ci:verify` (or GitHub Actions CI).  
2. Deploy.  
3. `GET /api/health` → `status` is `ready` (or accepted `degraded` with no critical blockers).  
4. Production critical failure → **503**.  

## Preview vs Production

- Preview → Pi Testnet + Staging Supabase.  
- Production → Mainnet keys only when intentional; separate Supabase project recommended.
