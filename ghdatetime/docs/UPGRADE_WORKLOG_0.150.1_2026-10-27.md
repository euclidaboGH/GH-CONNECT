# GreenHaven v0.150.1 — system improvement worklog

Date: 2026-10-27  
Scope: source-only improvements to the authoritative v0.150.1 archive.  
Status: ongoing; not a production approval.

## Work completed in this batch

- Kept `0.150.1` as the canonical package/release identity; no downgrade was made.
- Repaired stale source-contract checks that hard-coded historical release versions or looked only for phase notes at the repository root when the authoritative notes are stored in `docs/archive/phase-notes/`.
- Updated referral-identity assertions to verify the current canonical `resolvePublicIdentity(asGh)` implementation rather than an obsolete local variable name. The runtime resolver was not replaced or bypassed.
- Improved the daily reward entry point: the floating control now sits above the bottom navigation with safe-area spacing; the reward panel is a compact, non-modal popover rather than a blocking full-screen overlay; Escape/outside-pointer dismissal is supported; the close action remains disabled during a claim; reduced-motion styling remains in place; and the copy explains server authority and the 48-hour maturity schedule.
- Documented referral settlement and curation redistribution feature gates in `.env.example` with safe default values of `0`. This documents the flags; it does not enable either feature.
- Expanded CI to run the comprehensive source-only verification suite and the economy gate check before typecheck, lint and production build.
- Updated the message attachment regression check to recognize the richer existing `Message` attachment union and typed hydration, rather than requiring an obsolete narrow type and `as any` cast.

## Verification performed in this workspace

- `node scripts/verify-phase14-static.mjs`: PASS, 27/27 source-only checks.
- `node scripts/verify-economy-stage1-gates.mjs`: PASS; settlement/redistribution remain operator-gated.
- All `scripts/check-*.mjs` and `scripts/verify-*.mjs` checks passed except `scripts/check-node-runtime.mjs`, which correctly rejects this workspace's Node.js `v22.16.0` because the project requires Node.js `^24.15.0`.
- Project truth, release hygiene, dependency-lock integrity, JSX safety, Pi backend lock, clean migration, database-contract source, and migration release-readiness checks passed.

## Not yet verified

- `npm ci --legacy-peer-deps --no-audit` under Node.js 24.15.0.
- TypeScript, lint and Next.js production build under the supported runtime.
- Browser E2E, responsive visual regression, screen-reader/manual accessibility, performance/load tests, and live Testnet/provider behavior.
- Actual Testnet/Mainnet migration history, backup restoration, and deployment/rollback rehearsals.
- A complete manual review of every route, component, RLS policy, storage bucket, third-party integration, and all video-demonstrated journeys.

## Safety decisions

- No database migrations were added or changed in this batch.
- No financial, reward, payment, wallet, membership or Pi settlement logic was changed.
- No feature flag was enabled.
- No production/Testnet/Mainnet operation was executed.
- The logo remains unchanged pending the user's replacement asset.

## Next work package

1. Run install/typecheck/lint/build in a supported Node.js 24 environment.
2. Review build and runtime findings before modifying business logic.
3. Audit media signing, storage authorization, API ownership checks and Supabase RLS with tests.
4. Continue Phase 5 design-system consolidation and Phase 6 route/screen inventory, then validate the social and messaging journeys.
5. Keep the 12-phase master plan and explicit launch gates as the source of scope.


## System-wide verification improvement batch

- Audited the source tree inventory: 6 page entry points, 193 API route handlers, 133 SQL migration files, 166 TSX components, 406 `lib/` TypeScript modules, and 6 Playwright spec files. Inventory counts are not a substitute for manual review of each route or integration.
- Replaced the stale hard-coded production verification suite list. It had 41 historical/missing script entries that were silently marked `SKIP` while the runner could still report a success-style decision. The runner now discovers the current `check-*.mjs` and `verify-*.mjs` scripts, records each outcome, and fails if any discovered check fails.
- Added `npm run verify:production` and wired it into CI.
- Added `docs/architecture/SYSTEM_WIDE_AUDIT_0.150.1_2026-10-27.md` with the system inventory, launch-risk register, video-reference principles, safety boundaries, and remaining evidence requirements.
- Verification: discovery-based runner executed 40 source checks: 40 passed, 0 failed under Node.js v22.16.0. Node 22 remains unsupported; this does not certify typecheck, lint, or production build.
- No database migrations, payment/reward logic, feature flags, or live environments were changed.

## Payment-intent API hardening batch

- Added per-authenticated-user in-process rate limits to payment-intent creation (12 requests/minute) and listing (60 requests/minute). This is defense-in-depth only; production still needs edge/WAF rate limiting because in-process buckets do not coordinate across instances.
- Bounded the payment-intent creation request body before JSON parsing (16 KiB), rejected non-object JSON payloads, capped serialized metadata (8 KiB), bounded reference IDs (200 characters), and rejected idempotency keys over 128 characters or containing line breaks.
- Preserved authenticated-user scoping, the server-owned GHC pack intent route, PI-only currency policy for this endpoint, and the durable-write requirement before returning an intent.
- Added `scripts/check-payment-intent-hardening.mjs` and `npm run check:payment-intent-hardening`; the discovery-based release verifier automatically includes it.
- Verification: payment-intent hardening contract 11/11 passed; full discovered source verification 43/43 passed. Runtime remains Node.js v22.16.0 (unsupported for this project); build/typecheck/lint/browser/live-provider checks remain pending under Node.js ^24.15.0.
- No migrations, live payments, feature flags, wallet balances, or production environments were changed.

## GHC transfer API hardening and route inventory batch

- Hardened `app/api/economy/transfers/route.ts` to reject declared or actual request bodies above 16 KiB before JSON parsing, reject non-object JSON bodies, bound reference and request IDs, reject line breaks in those identifiers, and remove control characters from user transfer notes.
- Preserved authentication, recent step-up requirement, rate limiting, server-derived sender identity, recipient resolution via the public identity directory, server-side amount validation, and authoritative database RPC path.
- Added `scripts/check-transfer-request-hardening.mjs` and `npm run check:transfer-request-hardening`; the dynamic release runner now includes this contract.
- Added `docs/architecture/API_ROUTE_SECURITY_INVENTORY_0.150.1_2026-10-27.md` with static route counts, prioritized security queues, review criteria, and launch evidence requirements. Counts are explicitly labeled as inventory, not a completed manual audit.
- Verification: transfer hardening contract 12/12 passed; discovery-based source suite 44/44 passed. Workspace Node.js v22.16.0 remains below the required `^24.15.0`; typecheck, lint, build, browser E2E, and live integration gates remain outstanding.
- No migrations, financial settlement logic, feature flags, balances, or live environments were changed.

## Reward endpoint request-boundary hardening batch

- Bounded privileged creator-reward settlement payloads to 4 KiB before JSON parsing; rejects oversized declarations and actual UTF-8 payloads, invalid JSON, arrays and non-object bodies.
- Added a finite 15-second timeout to the creator-reward settlement RPC request so an upstream stall cannot hold the handler indefinitely.
- Bounded pending reward-claim payloads to 4 KiB, rejects malformed/non-object JSON and validates the hold ID length/line breaks.
- Preserved operator-key authorization, user authentication, rate limits, server-derived claim ownership/amount, and the authoritative database settlement/claim RPCs. No reward amounts, settlement rules, or financial flags changed.
- Added `scripts/check-privileged-reward-body-bounds.mjs` (13 contract checks) and exposed it through `npm run check:privileged-reward-body-bounds`; the dynamic release verifier discovers it automatically.
- This remains a source-contract guard, not an end-to-end proof of live RPC behavior or rate-limit distribution.


## Media diagnostic and direct-upload hardening batch

- Changed `/api/media/health` to return `401` to unauthenticated requests before reading server configuration or making storage requests. The health endpoint is now explicitly read-only and no longer attempts to provision a bucket during a `GET`.
- Kept the response shape compatible by retaining `bucketEnsured: null` and added `bucketProvisioning: "read-only"`; readiness now reflects configured credentials and successful bucket reachability.
- Added 8 KiB declared and actual UTF-8 body limits to direct-upload intent and completion endpoints, rejecting invalid JSON and array/non-object payloads. The upload intent flow only attempts bucket provisioning after its request body and file metadata have been validated.
- Added `scripts/check-media-api-hardening.mjs` (14 source-contract checks), package script `check:media-api-hardening`, and operator documentation.
- Verification: media API hardening checks 14/14 passed; discovery-based source verification 46/46 passed. Runtime is still Node.js v22.16.0, below required Node.js ^24.15.0; typecheck, lint, build, browser E2E, and live storage/RLS checks remain outstanding.
- No database migrations, financial logic, balances, feature flags, or live infrastructure were changed.

## Messaging request-boundary hardening batch

- Added shared `lib/server/http/read-bounded-json.ts` to enforce request limits against both declared Content-Length and actual UTF-8 bytes, reject malformed Content-Length, invalid JSON, and non-object JSON payloads.
- Applied the bounded parser to message creation (24 KiB), message edits/pin changes (16 KiB), and direct conversation creation (16 KiB). This closes the gap where the previous checks only bounded a declared Content-Length and treated malformed JSON as an empty object; requests without Content-Length now receive the same actual-byte enforcement.
- Preserved session-derived sender identity, existing conversation membership and privacy enforcement in the message store, and owned-media attachment validation. No database schema or messaging business rules changed.
- Added `scripts/check-messaging-bounded-json.mjs` with 12 regression checks and package script `check:messaging-bounded-json`; the discovery-based release verifier includes it automatically.
- Verification: messaging bounded JSON checks 12/12 passed; full discovered source suite 47/47 passed. The workspace runtime remains Node.js v22.16.0 and is unsupported for build checks; Node.js ^24.15.0, dependency installation, typecheck, lint, production build, browser E2E, and live messaging/RLS verification remain outstanding.
- No migrations, financial logic, balances, feature flags, or live infrastructure were changed.


## Messaging pagination and idempotency boundary hardening batch

- Added route-level bounds for message pagination cursors before passing them into the message store: cursor timestamps are capped at 80 characters and `beforeId` at 180 characters; both reject control characters and malformed cursor IDs return HTTP 400.
- Added a 180-character/control-character validation for client-supplied message idempotency keys, preserving the existing server-side idempotent append behavior for valid keys.
- Added `Retry-After` to message-send rate-limit responses so clients can back off predictably.
- Expanded `scripts/check-messaging-bounded-json.mjs` to cover cursor validation, idempotency-key bounds, retry hints and validation ordering.
- This is defense-in-depth: the existing message store still validates date cursor semantics and conversation membership. Rate limits remain in-process and must be supplemented by shared/edge enforcement in production.
- No schema, migrations, financial logic, flags, or live infrastructure changed. Full source suite and archive integrity are to be recorded after this batch is packaged.

## Messaging state endpoint hardening batch

- Applied the shared bounded JSON parser to conversation-level presence actions (2 KiB) and messaging preference updates (4 KiB). Both now reject oversized declared or actual UTF-8 bodies, malformed JSON, and non-object payloads with explicit client errors.
- Added conversation ID validation and per-user rate limiting to read-receipt updates, including `Retry-After` for throttled clients. The read receipt still updates only the authenticated member through the existing message-store function.
- Extended `scripts/check-messaging-bounded-json.mjs` from 16 to 20 contract checks and retained its package script.
- Verification: messaging boundary checks 20/20 passed; full discovered source suite 47/47 passed, 0 failed. Workspace runtime remains Node.js v22.16.0 (unsupported for production build checks); full build, typecheck, lint, browser E2E, and live database/RLS verification still require Node.js ^24.15.0 and a configured staging environment.
- No database migrations, financial behavior, feature flags, balances, or live infrastructure were changed.

## Conversation preference validation and throttling batch

- Hardened `app/api/messaging/conversations/[conversationId]/prefs/route.ts` with the shared 4 KiB bounded JSON parser, rejecting oversized bodies, malformed JSON, and non-object payloads.
- Added conversation ID validation and per-user write rate limiting with `Retry-After` responses.
- Require at least one supported preference field, validate booleans strictly, and reject non-integer, unsafe, negative, or out-of-range mute timestamps before the message store can convert them to ISO dates. Responses now echo only fields actually submitted and validated.
- Expanded messaging request-boundary regression checks to 25 assertions. Messaging boundary checks: 25/25 passed; full discovered source suite: 47/47 passed, 0 failed.
- Node.js v22.16.0 remains unsupported; supported-runtime typecheck, lint, production build, browser E2E, and live Supabase authorization tests remain required. Per-process rate limits are defense-in-depth, not a replacement for distributed enforcement.
- No database migrations, financial behavior, feature flags, balances, or live infrastructure were changed.

## Social database upstream timeout reliability batch

- Added a shared 12-second timeout to server-side social PostgREST RPC and direct REST requests using `AbortSignal.timeout`, preventing stalled upstream requests from holding application invocations indefinitely.
- Standardized timeout/network failure responses to stable `RPC_TIMEOUT` / `RPC_NETWORK` and `REST_TIMEOUT` / `REST_NETWORK` codes without returning raw exception messages to callers.
- Preserved service-role-only server-side access, no-store request behavior, and existing caller fail-closed semantics. No ranking, visibility, schema, or financial behavior changed.
- Added `scripts/check-social-upstream-timeouts.mjs` with eight source-contract checks and `npm run check:social-upstream-timeouts`.
- Verification: social timeout checks 8/8 passed; discovery-based source suite 48/48 passed, 0 failed. Runtime is Node.js v22.16.0, unsupported for the project's required Node.js ^24.15.0; typecheck, lint, production build, browser E2E and live Supabase checks remain outstanding.
- No migrations, financial logic, balances, flags, or live infrastructure changed. Timeout coverage does not replace production monitoring, upstream capacity testing, or distributed rate limiting.

## Database RLS source-coverage audit batch

- Added `scripts/check-database-rls-coverage.mjs` and `npm run check:database-rls-coverage` to statically compare executable migration `CREATE TABLE` statements with explicit `ENABLE ROW LEVEL SECURITY` statements.
- The check also identifies tables without any client policy and requires them to be in a small explicit review allowlist rather than silently assuming they are service-managed. Current source scan: 114 table names with RLS enabled, 103 tables with policy definitions, and 11 no-policy tables explicitly allowlisted for operator/service-role review.
- SQL comments are stripped before scanning to reduce false positives from proposal examples and documentation.
- Important limitation: static source coverage does not prove deployed RLS state, grants, policy predicate correctness, or that service-role credentials cannot leak. Each staging/production target still requires independent catalog/grant checks and multi-user negative tests.
- No SQL migration was added or modified; no live database, financial behavior, balances, flags, or infrastructure changed.

## SECURITY DEFINER function hardening audit batch

- Added `scripts/check-security-definer-acl.mjs` and `npm run check:security-definer-acl` to statically inspect executable migration source for `SECURITY DEFINER` functions, a function-level `SET search_path`, and an explicit migration-source `PUBLIC` execute revoke.
- Current scan found 274 SECURITY DEFINER declarations with a search path and a matching PUBLIC execute revoke in migration source. This check is included in the discovery-based production source suite.
- The checker is intentionally source-only: overloaded function signatures, effective role grants, ownership, deployed catalog state, and runtime exploitability still require live database verification. It is not a substitute for reviewing each function's authorization semantics.
- No SQL migration was added or modified, and no live database, financial behavior, balances, feature flags, or infrastructure changed.

## Media size-policy consistency batch

- Found a real cross-endpoint inconsistency: upload-intent and multipart upload accepted images/audio/PDFs up to 50 MiB, while direct-upload completion rejected the same assets above 25 MiB. This could leave already-uploaded objects and pending sessions that could never finalize under the API's own limits.
- Centralized per-MIME upload limits in `lib/server/media/path-policy.mjs`: image/audio/PDF up to 50 MiB, video up to 40 MiB, unsupported MIME types receive no allowance. Intent, multipart upload, completion, and metadata validation now share this policy.
- Preserved the existing advertised upload ceilings and video ceiling rather than reducing functionality. Added regression assertions for all MIME classes, unsupported types, and metadata validation.
- `scripts/check-media-api-hardening.mjs` now contains 20 checks; targeted run passed 20/20. Full release source verification and package integrity are recorded with this batch's release artifact.
- No migrations, financial behavior, balances, feature flags, or live infrastructure changed. Runtime/build and live storage verification limitations remain as documented above.

## Multipart media ingress preflight and side-effect ordering batch

- Hardened the buffered multipart `/api/media` ingress: it now rejects missing `Content-Length` with 411, malformed lengths with 400, unsafe numeric lengths and bodies above the 50 MiB media ceiling plus 2 MiB multipart allowance before calling `request.formData()`.
- Corrected the preflight cap to use the shared 50 MiB general media ceiling (rather than the narrower 40 MiB video ceiling), so valid images/audio/PDFs are not accidentally blocked by the request preflight.
- Moved bucket provisioning until after file signature/MIME, per-type size, bounded metadata, and owned-path validation. Invalid uploads therefore do not trigger storage provisioning as a side effect.
- Expanded `scripts/check-media-api-hardening.mjs` from 20 to 25 assertions, covering multipart auth/preflight and validation-before-provisioning. Targeted checks passed 25/25; the discovered source suite passed 50/50.
- Release report records `SOURCE_CHECKS_PASS — BUILD_AND_OPERATOR_VERIFICATION_STILL_REQUIRED`; local runtime is Node v22.16.0, below required `^24.15.0`. Build/typecheck/lint/browser tests and live storage/Supabase authorization remain unverified. No migrations or live infrastructure were changed.

## Media delivery internal-fetch trust-boundary batch

- Identified that `/api/media/[id]/content` derived the destination for its credentialed internal fetch from `new URL(request.url).origin`. In deployments where request host/forwarded headers are not fully canonicalized by the platform, this makes the destination depend on inbound request metadata while forwarding session cookies and Authorization.
- Changed the facade to use `NEXT_PUBLIC_APP_URL` or the deployment-provided `VERCEL_URL` as its canonical application origin. It normalizes VERCEL hostnames to HTTPS, accepts HTTPS in production, allows localhost HTTP only outside production, and fails closed with `APP_ORIGIN_NOT_CONFIGURED` if no trusted origin is available.
- Added regression checks ensuring the facade no longer derives its credentialed fetch destination from the request URL and fails closed for missing production configuration.
- Media API hardening checks: 27/27 passed. Full discovered source verification and archive integrity are run as part of packaging.
- Operator action: production deployments must set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS application origin (or rely on the trusted platform `VERCEL_URL`). No live database, storage, financial logic, feature flags, or infrastructure were changed.

## Media upload-session identity hardening — 2026-10-27
- Added `20261027010001_gh_media_upload_session_immutable_identity.sql` to prevent a repeated upload ID from rewriting the existing session's owner, bucket, storage path, media type, expected size, or metadata.
- Retries now use `ON CONFLICT DO NOTHING`, then compare the full immutable contract. Mismatches return `UPLOAD_ID_CONFLICT`; existing lifecycle state and expiration are not reset.
- Added `scripts/check-media-upload-session-immutability.mjs` and `npm run check:media-upload-session-immutability` for source-level regression guards.
- Migration is source-only and has not been applied to any database. Production rollout requires the normal reviewed migration process and live privilege/behavior verification.

## Shared bounded JSON streaming hardening — 2026-10-27
- Found that the shared JSON parser checked actual size only after `request.text()` had buffered the entire body. This made the configured limit a validation limit, not a true memory-ingress limit for requests without a trustworthy Content-Length.
- Replaced full-body text buffering with streaming byte accounting. The parser now rejects invalid/unsafe declared lengths, stops and cancels the stream immediately when actual bytes exceed the endpoint's configured maximum, and uses strict UTF-8 decoding before JSON parsing.
- This helper is used by messaging send/edit, conversation creation, presence, read receipts, and preferences endpoints, so the improvement applies across those API boundaries without changing their payload contracts.
- Expanded the messaging bounded-JSON source regression suite to cover streaming, early cancellation, safe lengths, and strict decoding. This is source-level regression evidence; runtime integration tests under the supported Node version remain required.

## Direct-upload JSON ingress streaming integration — 2026-10-27
- Extended the shared hard streaming JSON parser to both direct media-upload endpoints (`direct-upload-intent` and `direct-upload-complete`), replacing endpoint-local `request.text()` buffering and post-buffer byte checks.
- Both endpoints now enforce the existing 8 KiB limit while reading the request stream, cancel oversized streams early, reject invalid/unsafe declared lengths and malformed UTF-8/JSON, and map oversized requests to HTTP 413. Authentication and request-rate checks remain before body parsing; upload-intent validation remains before bucket provisioning.
- Updated media API regression guards to enforce shared parser use and the early-cancel contract. Targeted media checks passed 27/27; messaging parser checks passed 28/28; full discovered source verification passed 51/51.
- Release verification still reports `SOURCE_CHECKS_PASS — BUILD_AND_OPERATOR_VERIFICATION_STILL_REQUIRED`. The available runtime is Node v22.16.0 while `.nvmrc` requires Node 24.15.0; production build/typecheck/lint/browser E2E and live Supabase/storage verification were not performed. No migration, live database, balances, flags, or production infrastructure was changed.

## Media asset idempotency and immutable identity hardening — 2026-10-27
- Reviewed the durable media upload completion path against its SQL asset-creation contract and found that `gh_media_asset_create` used `ON CONFLICT (id) DO NOTHING` but always returned success. A retry with a reused ID could therefore be reported as successful even if the existing asset had a different owner, path, MIME, size, or metadata; a conflicting bucket/path unique key could instead surface as an unhandled database exception.
- Added `20261027010002_gh_media_asset_create_immutable_identity.sql`: asset creation now compares the complete persisted identity before reporting an idempotent success, rejects deleted/non-ready or mismatched records, and returns a stable `MEDIA_ID_CONFLICT` for identity/path conflicts. It does not overwrite existing records. Function execution remains restricted to `service_role` and the function has an explicit hardened search path.
- Added `scripts/check-media-asset-immutability.mjs` and `npm run check:media-asset-immutability` with source-contract guards for immutable fields, lifecycle state, conflict behavior, and ACL posture.
- Migration is source-only and has not been applied to a database. The checks do not replace live PostgreSQL concurrency/privilege testing; production rollout requires reviewed migration application and staging verification.
- Updated the generated migration inventory and verified manifest to include the new migration as `REVIEW_REQUIRED`; the repository now contains 135 migration files, with 34 explicitly marked for review. This is a documentation/source inventory update, not evidence of application to a database.

## Media upload finalization identity and lifecycle hardening — 2026-10-27
- Traced the direct-upload completion path through the durable upload-session RPC and found a cross-record idempotency bug: the original finalization function returned success for any supplied media ID whenever the session was already finalized, even if that ID differed from the stored media ID. The API could then return a newly-created record ID despite the session remaining bound to another record.
- Added `20261027010003_gh_media_upload_finalize_identity.sql`. Finalization now locks the owned session, allows idempotency only for the same media ID, rejects non-finalizable/expired states, and checks the media asset's owner, bucket, storage path, kind, MIME type, expected byte size, ready state, and deletion state before binding the session. Function execution remains restricted to `service_role` with an explicit hardened search path.
- Added `scripts/check-media-upload-finalize-identity.mjs` and `npm run check:media-upload-finalize-identity`; updated the generated migration checklist and verified manifest. Inventory now contains 136 migrations, with 35 marked `REVIEW_REQUIRED`.
- This is source-level hardening only. The migration has not been applied. Disposable PostgreSQL concurrency tests, schema compatibility review, supported-Node build/typecheck/lint, browser E2E, and staging Supabase/Storage verification remain required. No production database or infrastructure was changed.

## Payment reconciliation bounded-concurrency reliability batch — 2026-10-27
- Reviewed the authenticated read-only payment reconciliation endpoint and found that its durable intent list can contain up to 100 records while the handler used unbounded `Promise.all` to load marketplace orders. A single user request could fan out dozens of downstream reads at once, amplifying database load and transient failure during recovery/support checks.
- Replaced unbounded fan-out with a small ordered worker pool capped at five concurrent feature-record lookups. Results remain in original intent order, membership entitlement remains loaded once per request, and reconciliation stays read-only and user-scoped.
- Extended the Phase 14 source regression checker to enforce the concurrency bound, stable result ordering, and concurrency validation. This change does not alter payment state, fulfilment, balances, or provider calls.
- Verification is source-contract-only until supported-runtime build/typecheck and live integration tests are available. No database migration or production infrastructure was changed.

## Payment reconciliation request-rate protection batch — 2026-10-27
- Added per-authenticated-user request throttling to the read-only payment reconciliation endpoint (10 requests per minute) because each accepted request can load a user's intent history and multiple authoritative feature records.
- Rate-limited responses use HTTP 429, a `Retry-After` header, and the endpoint's existing no-store policy. The route continues to authenticate before work, remains user-scoped and read-only, and keeps its five-worker lookup bound.
- Extended the Phase 14 regression contract to check both the user-keyed limiter and response headers. This limiter is in-process and does not replace distributed edge/WAF rate limiting in multi-instance deployments.
- Verification remains source-level; live traffic and multi-instance behavior have not been tested.

## Shared rate-limiter memory-bound hardening — 2026-10-27
- Cross-system review found that the shared in-process limiter pruned expired buckets only when callers invoked cleanup and the map reached a threshold, but had no hard admission bound. Under high-cardinality traffic, active keys could grow memory usage without a strict ceiling.
- Added a fixed 50,000-bucket cap, input validation for keys and limiter configuration, expired-bucket reclamation at capacity, and fail-closed handling for new keys when all stored buckets are still active. Active buckets are not evicted to make room, avoiding a rate-limit reset/bypass for existing users.
- Added `scripts/check-rate-limit-memory-bound.mjs` and `npm run check:rate-limit-memory-bound` to protect the shared limiter's memory and fail-closed contracts. This improves all API routes using the common limiter, while remaining an in-process guard rather than a distributed edge control.
- Full discovered source verification passed 54/54. Runtime remains Node v22.16.0 while `.nvmrc` requires Node 24.15.0; build/typecheck/lint/browser E2E and multi-instance/production traffic verification remain outstanding. No database or production infrastructure was changed.

## Exported general-purpose rate-limiter capacity hardening — 2026-10-27
- Broadened the rate-limit audit beyond the economy-specific limiter to `lib/rate-limiter.ts`, which is publicly re-exported through `lib/index.ts`. The general utility previously had an unbounded `Map`, allowing high-cardinality keys to grow memory without a fixed ceiling.
- Added configurable 10,000-bucket default capacity, constructor validation, non-empty/512-character key validation, expired-entry cleanup at capacity, and a one-second cleanup throttle to avoid repeated full-map scans under sustained capacity pressure. Active keys are never evicted; new keys fail closed while capacity remains exhausted.
- Added `scripts/check-generic-rate-limiter-bound.mjs` and `npm run check:generic-rate-limiter-bound` to guard these source contracts.
- This utility is publicly exported but no direct in-repository application imports were found during the import search; the hardening protects consumers and downstream integrations without changing the existing boolean API. This remains an in-process limiter, not a distributed enforcement mechanism.
- Source verification is required below; supported-runtime build/typecheck/lint/browser E2E and live load testing remain outstanding. No database, payment, or production infrastructure was changed.


## Phase 2 durable authentication throttling fail-closed policy — 2026-10-27
- Security review found `checkDurableRateLimit` silently fell back to a process-local bucket whenever the durable Supabase RPC was unavailable. For Pi authentication, that could weaken throttling across instances without making the policy downgrade explicit.
- Added an explicit `onUnavailable` option. The compatibility default remains local fallback for existing callers, while `/api/auth/pi` now opts into fail-closed behavior and returns the existing HTTP 429 / `Retry-After` contract if durable throttling cannot be confirmed.
- Added `scripts/check-phase2-durable-rate-limit-fail-closed.mjs`; all six targeted source-contract checks passed. The full discovered source suite passed 56/56.
- Caveat: this does not prove the deployed RPC exists or is atomic, nor does it verify live grants, staging behavior, or multi-instance behavior. Fail-closed behavior trades availability for abuse-control integrity during RPC outages and requires monitoring. No production DB or infrastructure was changed.

## Phase 2 operator diagnostics access and read-only safety — 2026-10-27
- Route-level review found `/api/system/status` had no authentication despite returning privileged configuration/probe information, and its GET handler called `ensureMediaBucket`, which can create infrastructure. It also POSTed empty payloads to privileged RPCs to infer function presence; invoking an RPC is not inherently side-effect-free.
- Replaced anonymous access with a dedicated high-entropy `GH_SYSTEM_STATUS_OPERATOR_KEY` checked using constant-time comparison via `x-gh-system-status-key`. The endpoint now uses only bounded, read-only GET table probes, no longer provisions buckets or calls RPCs, and returns sanitized generic failures rather than exception messages/provider details. Responses are private/no-store.
- Added the key to `.env.example` with secret-handling instructions and `scripts/check-phase2-system-status-operator-only.mjs` with nine source-contract checks.
- Operational impact: operators must configure the dedicated secret before using this diagnostic endpoint. Missing/misconfigured secret denies access by default. No production secrets were generated or changed, and no live infrastructure was touched.

## Phase 2 continuation — privileged review and governance request hardening
- Removed the Supabase service-role key as a fallback HTTP secret for verification review; review now requires a dedicated `VERIFICATION_REVIEW_SECRET` of at least 32 bytes and timing-safe comparison.
- Bounded verification review POST bodies to 8 KiB and governance report/moderation mirror bodies to 12 KiB using the shared streaming JSON reader (including chunked requests).
- Prevented caller-supplied reviewer identity from becoming audit attribution; the API records the generic `authorized-operator` label until a first-class operator identity system is wired.
- Removed storage-layer exception text from verification review error responses and made review queue responses private/no-store; review queue failures now return a generic 503.
- Added `check:phase2-privileged-review-hardening` source-contract checks. These are source-level checks only; they do not replace runtime integration, deployed RLS/grant verification, or a formal audit identity model.

## Phase 2 continuation — creator reward operator boundary hardening
- Extended the privileged-route review to creator reward funding and settlement. Both operator-key checks now require at least 32 bytes before constant-time comparison; weak configured secrets fail closed.
- Reward-pool funding now uses the shared streaming bounded JSON parser with a 4 KiB hard cap and a 15-second upstream RPC timeout. This prevents unbounded `request.json()` buffering and avoids hanging indefinitely on the database RPC.
- Funding and settlement now return only allowlisted domain conflict codes; unexpected RPC/provider error strings are replaced with stable generic errors to avoid leaking database implementation details.
- Added `check:phase2-reward-operator-hardening` with seven source-contract checks and documented the dedicated server-only operator/review secrets in `.env.example`.
- Full discovered source suite passed 59/59. Current runtime is Node v22.16.0, while `.nvmrc` requires Node 24.15.0; build/typecheck/lint/browser E2E and live operator/RPC verification remain outstanding. No live database or production infrastructure was changed.

## Phase 2 continuation — privileged request parsing and admin secret floor

- Replaced creator-reward settlement's `request.text()`-then-check flow with the shared streaming bounded JSON reader. The previous pattern only checked the body size after reading the entire request into memory; the new path enforces the 4 KiB cap while streaming and cancels oversized input.
- Added a minimum 32-byte configured admin-key requirement to the operator-only revenue summary endpoint while retaining timing-safe comparison and the existing environment-variable compatibility path.
- Added `scripts/check-phase2-admin-body-and-secret-hardening.mjs` and the `check:phase2-admin-body-secret-hardening` package command.
- Verification scope is source-contract checks only; live operator credentials and deployed endpoints were not tested or changed.

## Phase 2 operator readiness and withdrawal request boundary hardening

- Operator Pi listing readiness and claim-readiness reports now fail closed when `GHC_ADMIN_API_KEY` is missing or shorter than 32 UTF-8 bytes; both use fixed-size SHA-256 digests with timing-safe comparison and no-store denial responses. This removes the previous unauthenticated-by-default behavior when the secret was unset.
- Withdrawal operator status transitions now parse JSON through the shared streaming parser with a hard 4 KiB cap, return 413 for oversized payloads, bound withdrawal IDs and metadata lengths, and reject control characters in settlement references/rejection reasons.
- Added `scripts/check-phase2-operator-readiness-withdrawal-bounds.mjs` and a package script for targeted regression coverage.
- No live database, migration, production secret, balance, or financial settlement behavior was changed. Operator reports now require deployment configuration of a strong `GHC_ADMIN_API_KEY`; configure it before using those reports.


## Phase 2 wallet and transfer data-integrity hardening

- Wallet reads now fail with a correlated 503 when durable transfer-request retrieval fails, instead of presenting an empty list that could be mistaken for authoritative state.
- Added an 8-second timeout to the direct Supabase REST transfer-request query so a stalled upstream cannot hold the wallet request indefinitely.
- Transfer-detail route now converts malformed percent-encoding into a stable 400 response, bounds reference IDs to 128 characters, rejects control characters before lookup, and preserves authenticated-party authorization.
- Added `check:phase2-wallet-transfer-integrity` with source-contract checks. These checks do not replace runtime, database, or multi-instance integration tests.

### Phase 2 — Transfer request streaming boundary
- Replaced the transfer API's `request.text()` buffering path with the shared streaming bounded JSON parser. The 16 KiB ceiling is now enforced against actual streamed bytes, not only the declared `Content-Length` or a post-buffer string length.
- Oversized bodies return HTTP 413; malformed JSON, invalid UTF-8, and non-object JSON are rejected before recipient resolution or authoritative transfer RPC execution.
- Preserved authentication, recent step-up requirement, per-user rate limiting, server-side amount validation, authenticated sender identity, public recipient resolution, and authoritative RPC settlement.
- Added `check-phase2-transfer-streaming-boundary.mjs` and updated the legacy transfer hardening checker to assert the new shared-parser contract.
- Validation: targeted checks and the full source verification suite are rerun after updating stale source assertions. Runtime is Node 22.16.0; project requires Node 24.15.0 for runtime-dependent release checks.

### Phase 2 — Privileged transfer RPC boundary hardening
- Hardened the shared server-side `rpcExecuteTransfer` wrapper so internal callers receive the same input checks as the HTTP route: non-empty distinct identities, finite positive amount, bounded/control-character-free reference and request IDs, and a bounded optional note.
- Added a 12-second upstream RPC deadline. Timeouts map to `NETWORK_TIMEOUT` with the existing reconciliation-safe guidance because a timed-out request may have committed at the database; callers must reuse the same reference rather than minting a new transfer.
- Removed propagation of raw Supabase/Postgres HTTP error bodies through the transfer error mapper; unexpected upstream failures now map to stable generic domain errors. The RPC remains authoritative for atomic ledger mutation.
- Added `check:phase2-transfer-rpc-boundary` with nine source-contract regression checks. No live database or production financial state was changed.

### Phase 2 — Transfer timeout HTTP semantics
- Corrected the transfer API's HTTP mapping so `NETWORK_TIMEOUT` returns 503 instead of falling through to a 400 client-error response. A timeout is an uncertain server-side outcome, not evidence that the client submitted invalid input.
- Preserved the stable reconciliation message and did not add automatic transfer retries. This avoids encouraging duplicate submissions with newly minted references when the first RPC may have committed.
- Added `check:phase2-transfer-timeout-response` with four source-contract checks. No database, production environment, or live balances were changed.

### Phase 2 — Economy database read integrity and bounded operations
- Added an 8-second timeout to wallet transaction-history reads and to the shared transfer-request RPC helper; existing transfer-reference lookups now also use a bounded three-row result set and an 8-second deadline.
- Wallet snapshot decoding now fails closed on malformed/non-finite or negative totals and on a response identity that does not match the requested user, rather than silently turning malformed numeric values into a plausible zero balance.
- Transaction history rejects malformed rows, invalid amounts/timestamps, and rows that do not belong to the requested user. Transfer reconciliation rejects invalid references, mismatched rows, and duplicate debit/credit sides rather than selecting an arbitrary record.
- Added `check:phase2-economy-database-boundaries` with ten source-contract assertions. Targeted economy/transfer checks and the full discovered source suite pass. The project runtime remains Node 22.16.0 in this environment, while `.nvmrc` requires 24.15.0; production build, typecheck, lint, browser E2E, and deployed database verification remain outstanding.
- No live balances, database schema, production secrets, or infrastructure were changed.

### Phase 2 — Economy RPC deadline and identity hardening
- Added explicit deadlines to previously unbounded privileged economy RPC calls for account-created-at initialization, pending reward staging, activity reward staging, pending reward claims, economic population statistics, claim-streak reads, claim-day commits, atomic daily claims, and transfer-orphan operator recovery.
- Claim-streak responses now reject a mismatched returned user identity instead of accepting another user's state under the requested identity.
- Added `check:phase2-economy-rpc-timeouts` with eleven source-contract assertions. The full discovered source suite passes 67/67, with targeted transfer/economy checks passing.
- Fixed the Stage 2 source-gate summary counter so the recovery path is counted as the seventeenth logical group when it passes; previously the summary incorrectly printed 16/17 while all gates passed.
- Source-only Stage 2 financial gates pass (16 critical migration groups plus recovery path), and static migration release-readiness passes for 136 migration files. Disposable PostgreSQL migration application and Testnet/Mainnet migration-history reconciliation remain required; no live database or production financial state was changed.
- Environment limitation remains: Node.js 22.16.0 is installed but `.nvmrc` requires Node.js 24.15.0. Production build, TypeScript, lint, browser E2E, and deployed database verification are not certified by these source checks.

## Phase 2 — transfer-request idempotency intent binding (2026-10-27)

- Added migration `20261027010004_ghc_transfer_request_idempotency_intent.sql` to make a transfer-request reference idempotent only when requester, payer, amount, and normalized note match the original request.
- Reusing a reference for different intent now returns stable `IDEMPOTENCY_CONFLICT` in both ordinary duplicate lookup and unique-constraint race recovery. A missing row during race recovery fails closed.
- Added reference and note length/control-character bounds at the database function boundary.
- Added `check:phase2-transfer-request-idempotency-intent` with ten source-contract assertions.
- Validation is static/source-level. The migration has not been applied to a live database; PostgreSQL execution and concurrent integration tests remain release gates.


## Phase 2 — transfer-request RPC ACL hardening (2026-10-27)

- Added migration `20261027010005_ghc_transfer_request_rpc_acl_hardening.sql` to explicitly revoke direct execution from PUBLIC, anon, and authenticated; retain execution for `service_role`; and harden the SECURITY DEFINER function search path.
- Migration aborts if the expected function signature is absent and performs metadata-only changes in a transaction; it does not mutate wallet or ledger data.
- Added `check:phase2-transfer-request-rpc-acl` with eight source-contract checks and updated the migration manifest/checklist.
- Static validation only; PostgreSQL execution and effective grant inspection remain deployment gates.

## Phase 2 — constrain transfer-request race recovery (2026-10-27)

- Tightened `ghc_create_transfer_request` unique-violation recovery: only the named `ghc_transfer_requests_reference_id_key` conflict is treated as an idempotent retry.
- Other unique-constraint violations are re-raised instead of being masked as a successful retry or a generic missing-row outcome. This avoids accidentally hiding future schema/logic failures as idempotency collisions.
- Expanded `check:phase2-transfer-request-idempotency-intent` to 11 assertions and refreshed the migration source manifest byte count.
- Validation: the idempotency contract check passed 11/11, the transfer-request RPC ACL check passed 8/8, and the discovered source verification suite passed 69/69.
- Remaining release gates: execute migrations and concurrency tests on PostgreSQL; run build/typecheck/lint/browser E2E under Node.js 24.15.0; verify effective grants in the target environment.

## Phase 2 — bounded withdrawal creation payload (2026-10-27)

- Replaced unbounded `request.json()` parsing in `POST /api/economy/withdrawals` with the shared streaming JSON parser and an 8 KiB hard body limit.
- Oversized bodies now return HTTP 413; malformed/invalid bodies return a stable HTTP 400 response. Parse failures are marked `Cache-Control: no-store`.
- Added `check:phase2-withdrawal-streaming-boundary` with nine source-contract assertions.
- No withdrawal logic, pricing, eligibility, settlement, ledger, or database state was changed. Validation is static/source-level; live PostgreSQL and runtime tests remain required.

## Phase 2 — financial request-body bounds across economy writes (2026-10-27)

- Replaced unbounded JSON parsing with the shared streaming parser for transfer-request creation, GHC pack purchase, ledger spend, utility purchase, and daily reward claim.
- Applied explicit 8 KiB limits to transfer requests, pack purchases, ledger spends, and utility purchases; daily reward claims use a 4 KiB limit. Oversized requests return HTTP 413; malformed/invalid payloads return stable HTTP 400 responses.
- Added `check:phase2-financial-body-bounds` with 20 source-contract assertions covering all five write endpoints.
- This is a request parsing/resource-boundary change only: it does not alter amount calculation, authorization, idempotency references, reward economics, ledger mutation, or database schema. Static checks are not a substitute for runtime and PostgreSQL integration tests.

## Phase 2 — payment lifecycle request-body bounds (2026-10-27)

- Replaced unbounded JSON parsing in Pi payment approval, completion, fulfillment, incomplete-payment recovery, and GH Pay order creation with the shared streaming JSON parser and an 8 KiB hard limit.
- Oversized payloads return HTTP 413; malformed or invalid JSON objects return HTTP 400 with stable error codes and `Cache-Control: no-store`.
- Added `check:phase2-payment-body-bounds` with 20 source-contract assertions.
- Existing authentication, payment provider verification, intent ownership, amount checks, idempotency, and fulfillment rules are unchanged. Static assertions do not replace runtime/provider or database integration tests.


## Phase 3 — database integrity and recovery controls (2026-10-27)

- Repaired the source verification orchestrator so it no longer executes `verify-database-backup-artifact.mjs` without its required backup-file argument. The verifier is an operator utility, not a zero-argument source test; the pack previously reported a false failure even when all actual checks passed.
- Registered `check:phase3-database-recovery` in `package.json`; the recovery contract now passes 10/10 checks.
- Regenerated the repository migration checklist/verified manifest from the canonical 138 migration files after detecting stale `VERIFIED_MANIFEST.txt` inventory data. `generate-migration-inventory.mjs --check` now passes without drift. Classification counts: 98 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 37 REVIEW_REQUIRED.
- Re-ran the production source verification pack: 73 passed, 0 failed. The report still correctly requires Node.js 24.15.0 build/typecheck/lint/browser gates and database/operator verification.
- No database connection was made, no migrations were applied, and no production backup or restore was performed. Phase 3 remains IN PROGRESS until isolated PostgreSQL restore/replay evidence and approved RPO/RTO measurements are recorded.

## Phase 3 continuation — post-restore catalog integrity gate (2026-10-27)

- Added `supabase/VALIDATE-RESTORED-DATABASE.sql`, a read-only PostgreSQL catalog gate intended exclusively for a disposable restored database. It checks critical identity/financial tables, RLS on GreenHaven tables, PUBLIC execute ACLs for `SECURITY DEFINER` functions, and pinned `search_path` settings. It reports unvalidated foreign keys and invalid indexes for human review rather than mutating them.
- Added `scripts/check-phase3-restore-catalog-gate.mjs` and the `check:phase3-restore-catalog-gate` package command; expanded the Phase 3 recovery contract to include this gate.
- Updated the Phase 3 runbook with when and how to use the catalog gate.
- Validation: full source verification 74/74 passed; static RLS source audit passed for 114 table names; SECURITY DEFINER source audit passed for 278 declarations; migration chronology and 138-file inventory checks passed.
- Release limitations: runtime is Node 22.16.0, while the project requires Node ^24.15.0. `psql` and `pg_restore` are not installed in this environment, so SQL parsing/execution, backup artifact inspection, isolated restore, migration replay, typecheck, lint, build, and E2E remain unverified. No database was connected to or modified.
