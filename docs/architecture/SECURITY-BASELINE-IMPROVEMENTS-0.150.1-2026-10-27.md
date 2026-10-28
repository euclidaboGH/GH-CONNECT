# GreenHaven v0.150.1 — Security baseline improvements

Date: 2026-10-27
Scope: deployment header hardening and source-level regression protection.

## Changes in this batch

1. Added `Strict-Transport-Security: max-age=31536000` to the global Vercel response headers. This header is meaningful only when the site is served over HTTPS; validate the production custom-domain topology before considering `includeSubDomains` or preload.
2. Added `X-Permitted-Cross-Domain-Policies: none` to disable legacy cross-domain policy files.
3. Added `X-Download-Options: noopen` as a defense-in-depth header for legacy clients.
4. Added `scripts/check-security-headers.mjs` and the `npm run check:security-headers` command.
5. Added `scripts/check-api-csrf-contract.mjs` and the `npm run check:api-csrf` command to guard the existing middleware's same-origin mutation protections, explicit webhook exception, malformed-origin rejection, and no-store rejection behavior.
6. Wired both checks into CI and the discovery-based production verification pack.

## Verification evidence

- Security-header regression checks: 7/7 passed.
- API CSRF source-contract checks: 7/7 passed.
- Dependency-lock integrity: passed.
- Discovery-based source checks: 42/42 passed.
- Static verification suite: 27/27 passed.

## Limits

These checks inspect source contracts and deployment configuration; they do not send real HTTP requests through the production edge, prove that the hosting provider emits the configured headers, or certify endpoint-level authorization. HSTS should be confirmed against the deployed HTTPS and domain setup. The existing CSP directive is specifically a `frame-ancestors` policy, not a complete restrictive Content Security Policy; a full CSP requires a separate nonce/hash and third-party integration review so Pi Browser, media, auth, and payment integrations are not accidentally broken.

The workspace runtime is Node.js v22.16.0, while the project specifies Node.js `^24.15.0`. Therefore typecheck, lint, dependency installation, and production build have not been certified in this environment. Live Supabase RLS/storage checks, migration restore rehearsal, provider/Testnet flows, multi-user concurrency tests, load testing, and browser-based visual/E2E tests remain launch gates.

## Next work package

Continue with a route-by-route authorization and data-flow audit, starting with account lifecycle, media signing, messaging, admin-only handlers, webhooks, marketplace orders, wallet/reward mutations, and payment recovery. Record a per-route evidence matrix and add integration tests for verified high-risk paths. Do not treat static string checks as a substitute for runtime security testing.
