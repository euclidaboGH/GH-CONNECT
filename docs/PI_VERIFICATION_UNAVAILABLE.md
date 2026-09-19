# "Verification unavailable" / Couldn't connect to Pi

## What the user sees
1. Pi Browser may authenticate client-side (Connecting \u2192 Authenticating \u2192 Verifying Pi identity with server...).
2. Then: **Couldn't connect to Pi** / **Verification unavailable**.

## Root cause (connect-tau.vercel.app, measured 2026-09-19)

Live probes:

```
GET  /api/health      \u2192 404 FUNCTION_RUNTIME_DEPRECATED
GET  /api/health/live \u2192 404 FUNCTION_RUNTIME_DEPRECATED
POST /api/auth/pi     \u2192 404 FUNCTION_RUNTIME_DEPRECATED
```

The **frontend** still loads; **all serverless API routes are offline**.
Client Pi.authenticate() can succeed, but POST /api/auth/pi never runs, so
server verification fails and the UI shows Verification unavailable.

This is **not** primarily a Pi Client ID bug when the flow reaches
"Verifying Pi identity with server...".

## Fix order (ops)

1. **Vercel \u2192 Project \u2192 Settings \u2192 Node.js Version** \u2192 **22.x or 24.x** (match package.json engines).
2. Redeploy from latest main (or promote a new deployment).
3. Confirm:
   ```bash
   curl -sS https://YOUR_HOST/api/health/live
   curl -sS https://YOUR_HOST/api/health
   ```
   Expect JSON, not plain-text FUNCTION_RUNTIME_DEPRECATED.
4. Env (Production):
   - NEXT_PUBLIC_PI_CLIENT_ID
   - PI_API_KEY (same Testnet/Mainnet as portal)
   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
5. Apply migrations gh_pi_identities + gh_sessions.
6. Retest in Pi Browser (Develop) with the registered app URL.

## Secondary failures (after APIs work)

| API error | UI message | Fix |
|-----------|------------|-----|
| IDENTITY_STORE_UNAVAILABLE (503) | Identity service unavailable | Supabase + migrations |
| SESSION_STORE_UNAVAILABLE (503) | Identity service unavailable | Supabase + gh_sessions |
| INVALID_PI_TOKEN | Verification unavailable | Sandbox/mainnet mismatch or bad token |
| AUTH_BRIDGE_FAILED (500) | Verification unavailable | Check Vercel function logs |

## Do not

- Treat the user as new when verification fails.
- Put PI_API_KEY or service role in NEXT_PUBLIC_*.
- Disable server verification to "make login work".
