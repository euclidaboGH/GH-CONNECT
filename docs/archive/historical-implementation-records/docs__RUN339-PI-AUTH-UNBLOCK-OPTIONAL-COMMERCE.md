# RUN339 — Pi authentication must not wait for optional commerce

Date: 2026-11-18
Base: user-uploaded `GREENHAVEN-0.338.99-RUN338-PI-AUTH-DIAGNOSTICS-SUPABASE-REVIEW.zip`

## Finding

In `contexts/pi-auth-context.tsx`, the official Pi authentication path verified the server identity and performed the durable `/api/auth/session` cookie round-trip, but then awaited optional SDKLite initialization, Pi plugin login, product discovery, and purchase restoration before calling `setIsAuthenticated(true)`.

That contradicted the code comment describing commerce initialization as non-blocking. A slow or stalled optional commerce operation could therefore leave a Pioneer appearing logged out even after the server-side Pi identity and durable GH session had been verified.

## Surgical correction

- Set the authenticated client state and success message immediately after the existing verified identity/session and onboarding lifecycle checks.
- Initialize optional commerce in a detached async task.
- Add token-free `PI_COMMERCE_SDK_INIT_START`, `PI_COMMERCE_SDK_READY`, and `PI_COMMERCE_SDK_FAILED` diagnostics.
- If optional commerce fails, keep the verified authentication state and leave commerce unavailable (`sdk = null`); do not install a local/mock commerce SDK in this production-auth path.
- Preserve official Pi authentication, `/api/auth/pi` verification, durable Supabase session persistence, HttpOnly cookie round-trip, identity mapping, onboarding rules, and Mainnet/Testnet configuration.

## Validation boundary

- Added `scripts/check-run339-auth-unblock.mjs` to both `prebuild:checks` and `verify:static`.
- The contract checks that authenticated state is set before detached commerce initialization.
- Full dependency-backed typecheck, lint, npm audit, and Next.js production build were not run in this environment.
- `package.json` and `package-lock.json` dependency versions were not upgraded. The RUN338 report records that npm registry access timed out; no lockfile integrity values were fabricated.
- No Supabase SQL, migration, RLS, grant, policy, identity, session, payment, ledger, or onboarding data was changed.
- No GitHub push, Vercel deployment, or Mainnet action was performed.

## Required device acceptance

After a reviewed Preview deployment, test in Pi Browser:
1. Fresh Pi authentication and first-time onboarding.
2. Returning Pioneer authentication.
3. Pi authentication cancellation.
4. Cookie round-trip and protected API access.
5. Optional commerce SDK unavailable or slow; the authenticated app must still become available while commerce remains unavailable.
