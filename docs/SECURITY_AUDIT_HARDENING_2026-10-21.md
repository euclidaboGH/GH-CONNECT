# GreenHaven security audit and hardening — 2026-10-21

## Scope

Source-level review of authentication/JWT validation, session lifecycle, profile writes, reward claims, GHC ledger APIs, conversation/message APIs, media authorization, social authorization/IDOR tests, migration/release controls, and CI integration. This is not a penetration test and does not certify the deployed Supabase project.

## Implemented in this pass

1. **JWT temporal and claim validation** (`lib/server/economy/auth.ts`)
   - HS256 JWTs now require a finite `exp` claim and reject expired tokens.
   - `nbf` and `iat` are validated when present, allowing only a 30-second clock-skew window.
   - Optional `GHC_AUTH_JWT_ISSUER` and `GHC_AUTH_JWT_AUDIENCE` enforce configured issuer/audience claims.
   - Subject values must be non-empty and bounded.
2. **Profile lifecycle authorization** (`app/api/profile/me/route.ts`, `lib/server/identity/profile-store.ts`)
   - Public profile PATCH can no longer set or clear `onboarded`.
   - Only the trusted onboarding-completion handler can change that flag via an explicit server-only option.
   - Profile reads/writes have per-user in-process rate limits; PATCH body is bounded to 64 KiB.
3. **Cross-origin mutation defense** (`middleware.ts`)
   - Mutating `/api/*` browser requests are rejected when the supplied `Origin` does not match the request origin or Fetch Metadata says `cross-site`.
   - Paystack webhook remains excluded because it is server-to-server and must use its own signature verification.
4. **Pi identity bootstrap throttling** (`app/api/auth/pi/route.ts`)
   - Adds an IP-keyed in-process limit of 12 attempts/minute and a 16 KiB declared-body limit before Pi Platform verification.
5. **Regression coverage and CI**
   - Added `scripts/test-critical-security-hardening.mjs` and wired it early into `ci:verify`.
   - Added the optional JWT claim variables to `.env.example`.

## Source-level verification run

- Critical security hardening: 20 assertions passed.
- Social authorization static scan: 39/39.
- IDOR static scan: 170/170.
- Session/step-up security contract: 25/25.
- Rewards reliability: 24/24.
- Messaging reliability: 32/32.
- Social messaging regression: 15/15.
- Media route hardening: 13/13.
- Private media signed URL checks: 10/10.
- Financial integrity: 11/11.
- Media/messaging/realtime: 16/16.
- Testnet beta gate policy: 18/18.
- Phase 1–10 integration audit: 21/21.
- Project integrity: 36 checks, 0 errors, 0 warnings.

The deployment network safety scan initially flagged that the new optional JWT issuer/audience environment references were not documented. They have now been added to `.env.example`; rerun the network safety check after this update.

## Important limitations and remaining risks

- The current `checkRateLimit` implementation is process-local. It is only defense-in-depth and does not provide reliable limits across Vercel instances or serverless cold starts. Production should use platform/WAF rate limits or a durable distributed limiter for authentication, messaging, and economic endpoints.
- The IP address used for the Pi bootstrap limit depends on trusted hosting proxy headers. Verify the production proxy's behavior; do not treat client-controlled forwarding headers as identity.
- Origin/Fetch Metadata validation is defense-in-depth, not a substitute for route authentication, authorization, RLS, and signed webhook verification. Non-browser clients without an Origin header are still governed by route-level authentication.
- A service-role key bypasses Supabase RLS. It must remain server-only, narrowly used, rotated if exposed, and never placed in browser bundles or logs.
- Source tests do not prove live SQL privileges, RLS behavior, concurrency correctness, or that remote migrations were applied. Validate on disposable PostgreSQL and the intended Testnet Supabase project before release.
- The full clean install, TypeScript check, lint, production build, live multi-user authorization tests, and external penetration test have not been completed in this environment.

## Release posture

Security hardening changes are implemented in source and targeted regression tests pass. **Not a Mainnet security sign-off.** Keep financial providers and withdrawals gated until the clean CI suite, database execution tests, Testnet multi-account tests, and operational monitoring/rate-limit configuration have evidence attached to the release.
