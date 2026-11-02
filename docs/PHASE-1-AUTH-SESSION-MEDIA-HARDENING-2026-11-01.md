# Phase 1 — Authentication, Session Identity, and Media Request Hardening

**Baseline:** GH-CONNECT `0.274.3`  
**Date:** 2026-11-01  
**Scope:** Authentication request boundaries, session-derived identity contracts, media upload authorization, and social/messaging request regressions.

## Confirmed defect fixed

`POST /api/auth/pi` previously called `request.text()` before enforcing its 16 KiB request-body limit. The route checked the byte count only after buffering the complete body, so a chunked request without a trustworthy `Content-Length` could force excess memory consumption before rejection.

The route now uses `readBoundedJson(request, 16_384)`, the shared streaming parser. It rejects an oversized declared length before reading, cancels a streamed body as soon as the hard byte limit is exceeded, strictly decodes UTF-8, rejects malformed JSON and non-object payloads, and returns HTTP 413 for oversized requests. Authentication still verifies the access token with Pi before issuing a GH session; client-supplied `uid`/`ghUserId` are not authoritative. Durable rate limiting remains fail-closed in production.

## Regression protection added

- Added `scripts/check-pi-auth-bounded-json.mjs` with eight checks for streaming bounds, error mapping, strict JSON handling, and absence of unbounded body buffering.
- Registered the check as `npm run check:pi-auth-bounded-json` and in `verify:static`.
- Reused the existing bounded parser rather than introducing a second implementation.

## Phase 1 verification evidence

Passed after the change:

- Pi auth bounded JSON: 8/8.
- Bounded JSON runtime tests: 9/9.
- Canonical identity contracts: 17/17.
- Profile identity integration: 16/16.
- Identity integration/recovery evidence contracts: 17/17.
- Media API hardening: 27/27.
- Media upload-session immutability: 8/8.
- Media asset immutability: 11/11.
- Media upload finalization identity: 11/11.
- API CSRF contract: 7/7.
- Security headers: 7/7.
- Durable authentication rate-limit contract: 6/6.
- Social experience: 24/24.
- Messaging bounded JSON: 28/28.
- Message media hydration contract: 5/5.
- Social upstream timeout contract: 8/8.
- Session/domain bridge contracts: 16/16.

These are repository-level source/runtime-contract checks, not live-provider or deployed-database evidence. The full `verify:static` suite and Node 24 production build remain separate gates.

## Preserved safeguards

No authentication bypass, permissive fallback, session identity substitution, media ownership relaxation, migration application, wallet behavior change, or dependency downgrade was introduced. No production database was contacted or modified.

## Remaining Phase 1 gates

1. Run the complete `verify:static` suite.
2. Run `npm ci --legacy-peer-deps`, TypeScript, ESLint, and production build under the required Node 24 runtime.
3. Test Pi auth, session persistence, account switching, and private media against a dedicated Testnet environment using two separate test users.
4. Record response status and server-side evidence for unauthorized upload completion, owner/path mismatch, invalid session, and oversized streamed auth bodies.
