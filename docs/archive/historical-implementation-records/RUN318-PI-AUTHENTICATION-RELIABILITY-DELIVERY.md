# GH-CONNECT Run 318 — Pi authentication reliability repair

**Date:** 17 November 2026  
**Package:** `gh-connect@0.338.99` (Run 318 working derivative)  
**Authoritative user source archive:** `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip`  
**Working source:** current `testnet` branch project tree / 0.338.99 Run 317 derivative  
**Scope:** Pi SDK bootstrap, Pi Platform token verification, GH identity/session bridge, retry/error behavior.

## Confirmed source weaknesses and repairs

1. **Pi Platform outages were indistinguishable from invalid access tokens.** `verifyPiAccessToken()` returned `null` for all non-2xx responses, malformed responses, timeouts and network failures. The auth bridge then labelled every failure `INVALID_PI_TOKEN` / HTTP 401. This could tell a Pioneer to sign in again when Pi's verification service was temporarily unavailable.
   - Added `verifyPiAccessTokenDetailed()` with distinct outcomes for invalid credentials (401/403), upstream unavailability (429/5xx/network/other non-success), and malformed Pi responses.
   - Kept the existing nullable `verifyPiAccessToken()` wrapper for other call sites, preserving its public contract.
   - The Pi bootstrap route now returns HTTP 401 only for rejected credentials, HTTP 503 for transient Pi outages, and HTTP 502 for malformed upstream identity responses. Responses remain `no-store`; no token or credential is logged.

2. **The GH client could start overlapping authentication attempts.** Automatic bootstrap and a user tapping Retry could enter the same async initialization path concurrently while a slow Pi Browser bridge was still responding.
   - Added a single-flight guard around the full client auth attempt. The guard releases in `finally`, including early-return/error paths, so retries remain possible.
   - Added explicit handling for HTTP 429 and the server-provided `Retry-After` value.
   - Corrected the prior unreachable 503 handling: the generic `>=500` branch now excludes 503, allowing the dedicated identity/verification-unavailable branch to report the actual server detail.

3. **Regression contract added.** `scripts/check-run318-pi-auth-reliability.mjs` is registered in both `prebuild:checks` and `verify:static`.

## Verification

- Run 318 Pi auth reliability contract: **11/11 passed**.
- Phase 4 identity/authentication source contract: **16/16 passed**.
- Run 277 Pi auth and premium contract: **30/30 passed**.
- Phase 7 Pi identity and payout authorization contract: **10/10 passed** after updating its source assertion to the new detailed verifier. The underlying authorization rules remain unchanged.
- Full `npm run verify:static`: **passed**.
- Prebuild dry-run: **365 checks discovered**, with Run 318 first in the list.

## What is not claimed

- This source repair does not prove that the user's specific Pi Browser authentication failure is resolved. No live Pi access token was available for a real `/v2/me` round-trip, and no Android/Pi Browser device session could be driven here.
- The current Vercel deployment `dpl_7Xt8jvQb9bxDZSFJgEd7aRS5hcBP` is `READY`, but that is deployment readiness, not successful Pi sign-in acceptance.
- Vercel runtime error aggregation for the last 24 hours showed only Node deprecation warnings on the withdrawals process route; it did not expose a Pi auth error group. The Hobby runtime-log query for a 24-hour window was rejected because the plan retains a shorter window.
- Supabase Testnet read logs show successful service-role reads/writes for existing sessions, rate-limit RPCs and app data. Those records do not prove that Pi's `/v2/me` accepted or rejected a particular access token.
- This workspace runs Node 22.16.0 while the project requires Node 24.15.0; no dependency-backed typecheck, ESLint run or Next.js production build is claimed.

## Preserved safety boundaries

- No GitHub branch push or pull request was made.
- No Vercel deployment, promotion, rollback or environment-variable mutation was made.
- No Supabase SQL, migration, RLS, grant, policy or data mutation was made.
- No wallet, ledger, withdrawal PIN, consent, payment, payout, A2U or Mainnet setting was changed.
- Pi identity still requires official Pi SDK authentication and server-side `/v2/me` verification before a durable GH identity/session is issued.
- The 0.338.93 archive remains the user's authoritative source archive; this Run 318 tree is a working derivative only.

## Required acceptance

1. Deploy this candidate to Preview on Node 24.15.0 after the user approves repository/deployment changes.
2. Open the canonical registered app URL in Pi Browser and test fresh consent, returning-user login, user cancellation, offline Pi API, expired token, retry and account switching.
3. Confirm `/api/auth/pi` reports 401 only for an actually rejected token and 503/502 for the corresponding transient/malformed upstream cases.
4. Re-test the session cookie in the embedded Pi Browser context and verify protected routes remain server-session authenticated.
5. Keep production **NOT APPROVED** until all build, security, provider and device acceptance gates pass.
