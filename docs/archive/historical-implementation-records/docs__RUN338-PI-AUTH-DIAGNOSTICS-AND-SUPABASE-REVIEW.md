# RUN338 — Pi Authentication Diagnostics and Supabase Review

Date: 2026-11-18
Base: RUN337 GitHub audit/environment repair archive

## Scope

- Add token-free stage codes around Pi SDK initialization and `Pi.authenticate()`.
- Add stage codes around `/api/auth/pi` Platform API verification, durable identity resolution, and GH session issuance.
- Add a post-login `/api/auth/session` round-trip so the browser must prove that the HttpOnly GH session cookie was stored and returned before the client marks the server session ready.
- Add a read-only SQL diagnostic script for Supabase Testnet.
- No auth bypass, local fallback in production, token persistence, balance mutation, payment mutation, schema migration, RLS change, or Mainnet action.

## Diagnostic codes

Client SDK stages include `PI_SDK_INIT_START`, `PI_SDK_INIT_OK`, `PI_SDK_INIT_FAILED`, `PI_AUTH_PROMPT_START`, `PI_AUTH_PROMPT_OK`, `PI_AUTH_PROMPT_REJECTED`, and `PI_AUTH_RESULT_MISSING_TOKEN`.

Backend stages include `PI_AUTH_ROUTE_REACHED`, `PI_PLATFORM_VERIFY_START`, `PI_PLATFORM_VERIFY_OK`, `PI_IDENTITY_RESOLVE_START`, `PI_IDENTITY_RESOLVE_OK`, `PI_SESSION_CREATE_START`, `PI_SESSION_CREATE_OK`, and `PI_AUTH_COMPLETE`.

Cookie round-trip stages include `PI_SESSION_COOKIE_MISSING`, `PI_SESSION_COOKIE_INVALID`, `PI_SESSION_COOKIE_VALID`, `PI_SESSION_COOKIE_VERIFY_OK`, and `PI_SESSION_COOKIE_VERIFY_FAILED`.

Diagnostics deliberately exclude access tokens, raw session cookies, token hashes, Pi UIDs, usernames, request bodies, and raw exception messages. Correlation IDs and HTTP status codes may be logged. The UI displays a stable diagnostic code on failure.

## Supabase Testnet read-only observations

Project: `tpckwgdsjlkzscjlxiwe`.

- `public.gh_pi_identities` exists and contains 6 rows.
- `public.gh_sessions` exists and contains 264 rows.
- Session counts: 176 revoked, 72 expired but not marked revoked, 16 currently active.
- No blank identity keys, no malformed SHA-256 token-hash lengths, and no invalid expiry ordering were found in the summary checks.
- All 6 identity rows have a non-null verification timestamp.
- Both tables have RLS enabled and a `FOR ALL` policy with `USING (false)` and `WITH CHECK (false)`.
- `anon` and `authenticated` nevertheless have table-level SELECT grants on both tables. RLS denies row access under the current policy, but these grants are unnecessary and should be reviewed for least privilege in a separately reviewed migration. No grant was changed in RUN338.
- `service_role` has the privileges required by the server REST persistence path.
- `gh_security_events` shows 44 `auth.pi.success` events in the last 7 days, latest at `2026-11-17 15:17:33 UTC`; no `auth.pi.rejected` or stage failure events were present in that period. This suggests the durable server-side bridge has succeeded previously, but does not prove the current browser login reached the route.
- Vercel Hobby runtime log retention did not permit a 24-hour historical query. A 50-minute query returned no runtime error groups and no matching `auth/pi` logs. This is not proof of no failures outside that window.

## Authentication implications

The existing backend path verifies the Pi access token using Platform `GET /v2/me`, resolves a stable Pi-to-GH mapping, and writes an opaque GH session token hash to `gh_sessions`; the raw GH token is sent only in an HttpOnly cookie. The new client check verifies that the cookie returns on `/api/auth/session`, that the session is durable, and that the verified GH identity matches the identity returned by the bridge. If the browser blocks or drops the cookie, the client now reports the cookie-stage diagnostic instead of treating the server session as ready.

## Dependency remediation status

The npm registry could not be reached from the execution environment (npm metadata requests timed out). Therefore RUN338 intentionally does not modify `package.json` or `package-lock.json`, and does not fabricate package integrity values or claim the 29-finding audit is fixed.

The attached GitHub audit artifact reported 29 findings. The known direct remediation candidates include Next.js 15.5.29, isomorphic-dompurify 4.7.0, Zod 4.6.7, SimpleWebAuthn 13.3.3, and Playwright 1.55.1 as the minimum version that clears the recorded Playwright advisory. Transitive fixes also include patched `sharp`, `postcss`, `undici`, `picomatch`, `minimatch`, `brace-expansion`, and `follow-redirects` releases.

The remaining `pi-backend@0.1.3` → `stellar-sdk@10.4.1` dependency chain reports vulnerable Axios and TOML packages without an npm-provided safe fix. The app uses `pi-backend` for A2U creation/completion, cashback, withdrawals, and qualification. Do not force an override or replace this SDK without Testnet transaction creation, completion, receipt verification, idempotency, and recovery tests.

Regenerate and verify the lockfile on a network-enabled Node 24.15+ machine after reviewing and applying the compatible package updates. Required commands:

```bash
node --version
npm ci --ignore-scripts
npm install --save-exact next@15.5.29 @next/eslint-plugin-next@15.5.29 eslint-config-next@15.5.29 isomorphic-dompurify@4.7.0 zod@4.6.7 @simplewebauthn/browser@13.3.3 @simplewebauthn/server@13.3.3 @playwright/test@1.55.1
npm audit fix
npm install --package-lock-only --ignore-scripts
npm ci
npm audit --json > npm-audit-after-run338.json
npm run typecheck
npm run lint
npm run verify:static
npm run build
```

Review npm audit output after the update; the above commands do not guarantee a zero-finding audit because the Pi SDK dependency chain needs a separate compatible remediation. Do not bypass the audit gate.

## Validation

- RUN338 diagnostic source checks: 25/25.
- TypeScript syntax transpilation for modified TS/TSX files: 4/4.
- Full dependency-backed typecheck, lint, npm audit, and Next production build: not run because dependencies could not be installed from the npm registry in this environment.

## Deployment state

No GitHub push, Vercel deployment, Supabase migration, SQL write, grant change, or Mainnet operation was performed. RUN338 is a local source derivative for review and GitHub Desktop handoff, not a deployed release.
