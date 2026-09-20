# GreenHaven / GH-CONNECT — Forensic & operational status

Generated from repository inspection (not a claim of Production readiness).

## Architecture (current)

```
Pi SDK (browser)
  → POST /api/auth/pi  (server: /v2/me → gh_pi_identities → gh_session cookie)
  → resolveAuthenticatedUser (cookie | Pi Bearer | optional JWT | dev-only non-prod)
  → profile / economy / messaging / payments APIs

Client shell:
  AppWrapper (PiAuth → SessionLockGate)
  → page providers (Identity, Connections, Discovery, Feed, WalletRead, GHC, Messaging, Notifications)
  → GHConnectApp onboarding gate (resolveUiOnboardingGate)
```

### Persistence by feature

| Feature | Server-durable when configured | Client/session |
|---------|--------------------------------|----------------|
| Pi identity / session | gh_pi_identities, gh_sessions | cookie + IdentityService |
| Profile | gh_user_profiles | localStorage cache / hydrate |
| GHC wallet / rewards | ledger RPCs | UI cache only |
| Pi payments | ghc_payment_intents | — |
| Messaging | gh_* tables (flag) | local domain default |
| Posts / feed | — | session store |
| Communities | partial adapters | often localStorage |

## Returning-user path (code)

1. Server `onboardingCompleted` is authoritative when identity store is durable.
2. `lib/onboarding-local.ts` recovers complete **local** profiles only when server still says required (legacy / non-durable).
3. `unknown` must not force registration (`app.tsx` + `resolveUiOnboardingGate`).
4. `unavailable` shows identity-service error, not registration.
5. PIN (`SessionLockGate`) is device unlock, not Pi auth.

## Production blockers (must fix outside pure code)

1. **FUNCTION_RUNTIME_DEPRECATED** on `connect-tau.vercel.app` — API routes and even `/` return 404 with this header. Without working Node functions, `/api/auth/pi` cannot verify identity → users appear new or stuck.
2. Confirm Vercel **Node.js 24.x** on the **same** project that owns the domain; **Redeploy** Production.
3. Set Production env: `NEXT_PUBLIC_PI_CLIENT_ID`, `PI_API_KEY`, `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Apply Supabase migrations (identity, sessions, profile, ledger, payments, messaging).
5. Verify `GET /api/health` returns JSON (`ready` / checks), not deprecation text.

## Security posture (static)

- Money routes use `resolveAuthenticatedUser` + ownership.
- Dev `Bearer user:` blocked in production.
- Memory ledger blocked on Vercel/production.
- Admin credit requires secret key (timing-safe compare in Pass 1).
- Live two-account IDOR still requires Staging.

## Do not claim

Production-ready auth, cross-device posts/communities, or verified Production DB until health + migrations + env are proven live.
