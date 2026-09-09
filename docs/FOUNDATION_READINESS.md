# GH CONNECT — Foundation readiness (Step 1)

This document is the **release gate** for environment, Pi network mode, and durable identity/sessions.  
Ship social features only after this gate is green in the target environment.

## Why this exists

Major platforms separate **dev / staging / production** credentials and fail closed when config is wrong:

| Platform | Pattern |
|----------|---------|
| **Meta / Facebook** | Development Mode vs Live; roles whitelist before public |
| **X (Twitter)** | Up to 3 apps: development, staging, production; never use dev keys in prod |
| **Vercel** | Production checklist + Deployment Checks before promoting to domain |
| **Pi Network** | Testnet vs Mainnet **app registration**; `Pi.init({ sandbox })` must match API key network |
| **Industry health checks** | Probe real dependencies; return **503** when not ready — not only `{ ok: false }` with HTTP 200 |

GH CONNECT adopts the same discipline for a Pi Browser app: wrong network or memory-only identity looks like “product bugs” (repeat onboarding, Payment Expired).

---

## Endpoints

| URL | Purpose | Failure HTTP |
|-----|---------|--------------|
| `GET /api/health/live` | Process liveness only | Always 200 if up |
| `GET /api/health` | **Release readiness** (full checks) | **503** if production + critical blockers |
| `GET /api/payments/health` | Payment rail subset + matrix | **503** if production + payment critical missing |

Response header: `X-GH-Readiness: ready | degraded | not_ready`

---

## Sandbox vs Mainnet matrix (Pi)

| Concern | Sandbox / Testnet | Mainnet / Production |
|---------|-------------------|----------------------|
| `Pi.init({ sandbox })` | `true` | `false` |
| `NEXT_PUBLIC_PI_SANDBOX` | `true` (or auto on localhost / Vercel preview) | `false` (or auto on Vercel production) |
| Developer Portal **App Network** | Testnet | Mainnet |
| `PI_API_KEY` | Testnet / Develop key for **that** app | Mainnet key for **that** app |
| `NEXT_PUBLIC_PI_CLIENT_ID` | Sign-in client for that app | Sign-in client for that app |
| Payments | Test-π | **Real π (irreversible)** |
| Local dev URL | `http://localhost:3000` | Production HTTPS origin |
| Sign-in callback | `{origin}/signin/callback` | Must match portal registration |

**Never mix:** Mainnet API key + `sandbox: true`, or Testnet key + production host.  
Symptom: approve timeout / Payment Expired / confusing auth.

---

## Critical production checklist

Before calling production “ready”:

1. [ ] `NEXT_PUBLIC_PI_CLIENT_ID` set on Vercel **Production**
2. [ ] `PI_API_KEY` set (server-only) — **same network** as portal app
3. [ ] `NEXT_PUBLIC_PI_SANDBOX=false` on Production (or rely on auto mainnet)
4. [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set
5. [ ] Migrations applied: at least `gh_pi_identities`, `gh_sessions`
6. [ ] `GET /api/health` → `"status": "ready"` and **HTTP 200** (not 503)
7. [ ] `GET /api/payments/health` → `ready: true`
8. [ ] `GHC_ALLOW_DEV_AUTH` **unset** on Production
9. [ ] Smoke in **Pi Browser**: sign-in, returning user skips onboarding, 0.01 π approve path

---

## Interpreting `/api/health`

```json
{
  "ok": true,
  "ready": true,
  "status": "ready",
  "environment": {
    "isProduction": true,
    "piSandbox": false,
    "networkLabel": "mainnet"
  },
  "checks": [ { "id": "pi_api_key", "status": "pass", ... } ],
  "blockers": [],
  "networkMatrix": { ... }
}
```

| `status` | Meaning |
|----------|---------|
| `ready` | No critical failures |
| `degraded` | Warnings or non-prod critical gaps |
| `not_ready` | Production critical gap — **do not promote traffic** |

---

## Durable identity (why Supabase is required in prod)

Without durable `gh_pi_identities` / `gh_sessions`:

- Returning Pioneers may see full registration again after cold start
- PIN unlock + Pi re-init can look like “logout”
- Multi-instance Vercel does not share process memory

Memory stores are acceptable for **local/dev** only.

---

## Operator workflow

1. Deploy preview → open `/api/health` → fix blockers  
2. Configure Production env → redeploy  
3. Confirm `/api/health` and `/api/payments/health`  
4. Pi Browser end-to-end smoke  
5. Only then continue product work (communities, growth, staking UI)

---

## Out of scope for this foundation step

- Social feature redesign  
- GHC ledger rule changes  
- Replacing Pi authentication  
- Passkeys / new login systems  
