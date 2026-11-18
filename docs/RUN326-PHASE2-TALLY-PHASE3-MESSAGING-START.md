# GreenHaven RUN326 — Phase 2 atomic tally source work and Phase 3 messaging start

**Baseline:** `GREENHAVEN-0.338.99-RUN325-FULL-AUDIT-REFERRAL-SCHEMA-FIX.zip`  
**Package:** `gh-connect@0.338.99` (unchanged; source-only engineering increment)  
**Disposition:** local candidate only. Not pushed, not deployed, no database migration applied. Production remains NOT APPROVED.

## Phase 2 — examination and election completion

The RUN324 timed-examination lifecycle, answer-key privacy, server deadlines, attempt limits, resume/autosave, server scoring and owner-controlled review/release remain in place. Contest, candidate and agent administration remain owner-scoped.

### Atomic election tally submission added

- Added authenticated `POST /api/research/projects/:id/elections/:contestId/tallies`.
- Actor identity is taken only from the authenticated server session; caller-supplied actor IDs are not accepted.
- Request body is bounded; IDs, polling-unit code, integer counts, candidate count and duplicate candidate IDs are validated.
- Candidate vote totals must equal valid votes. Registered/accredited voter and total-ballot arithmetic is checked.
- The endpoint uses one service-role RPC call; it does not perform separate parent/child REST writes.
- Added a held SQL proposal for `gh_research_election_tally_submit`. The function validates active contest/project scope, active country-matched geography and descendants, active candidates, accepted/active scoped agent assignment and voter arithmetic. A transaction-scoped advisory lock serializes the same contest/polling-unit/agent retry identity.
- Exact retries return the original tally. Reuse of the same identity with changed payload returns `IDEMPOTENCY_CONFLICT`.
- Parent tally, candidate vote rows and audit event are inserted in one database transaction. New tallies remain `pending`; this does not certify election results.
- The SQL is a proposal, not a migration. It depends on `20261116182000_gh_research_intelligence_platform_foundation.sql`, which remains REVIEW_REQUIRED and unapplied. No tally UI is enabled against a missing function or unseeded geography dataset.

### Phase 2 remains externally gated

- The three Research Intelligence / Media Evidence / Scoped Evidence migrations still require disposable PostgreSQL rehearsal and exact target history reconciliation.
- The tally proposal requires PostgreSQL syntax/behavior rehearsal, duplicate/concurrent submission tests, failure rollback tests and separate Testnet approval before migration generation/application.
- Geography datasets remain unseeded and must come from authoritative country sources.
- Trusted malware scanning remains unconfigured; evidence stays quarantined until a trusted provider verifies it.
- Real Pi Browser, exam and election Testnet acceptance remains outstanding.

## Phase 3 — Feed, Community, Messaging and Marketplace

Phase 3 continues as a set of independent workstreams; no claim is made that all four are complete.

### Messaging hardening added

- Durable message idempotency now compares the original request payload, not merely the client message ID.
- The comparison covers message body, reply target, shared-post identity and normalized durable media attachments.
- Exact retries return the original message without duplicate notification fan-out.
- Reusing the same key with changed content returns HTTP 409 `IDEMPOTENCY_CONFLICT` in both the initial lookup and unique-constraint race-recovery path.
- The client retry wrapper treats this conflict as terminal rather than retrying an invalid payload.

### Existing Phase 3 foundations retained

- Feed: safe engagement aggregates, server-side visibility/privacy filtering, durable account-scoped preferences, deterministic keyset pagination and account-switch response fencing.
- Community: bounded accessible poll state, durable moderation, pinned/Top/Hot ordering, read-only historical cards and cursor-safe community pagination.
- Messaging: durable server-first send, single write owner, unique client-message idempotency, private media authorization and delivery/notification controls.
- Marketplace: normalized server-filtered search, seller/discovery refinements, saved-address source/API/UI behind a held migration, and existing commerce/payment authority boundaries.

## Verification

- Phase 2 exam/election source contract: 22/22.
- Phase 2 atomic election tally source contract: 20/20.
- Phase 3 messaging idempotency source contract: 10/10.
- Phase 3 marketplace search quality: 6/6.
- Phase 3 community poll accessibility: 10/10.
- Phase 3 post engagement count hardening: 6/6.
- Creator/media hardening: 13/13.
- Upload cancellation/identity: 12/12.
- Creator draft recovery: 11/11.
- Durable media URL policy: 7/7.
- Upload recovery reliability: 9/9.
- Community pagination: 12/12.
- Community completion: 21/21.
- Feed quality: 25/25.
- Durable feed preferences: 13/13.
- Run #300 release integrity: 22/22.
- Run #301 release-gate hardening: 20/20.

These are focused source-contract checks. They do not establish PostgreSQL execution, full TypeScript compilation, dependency-backed lint/build, live database operation, browser/device acceptance or deployment readiness.

## Safety boundary

No GitHub push, Vercel deployment/promotion, Supabase mutation, SQL migration application, Mainnet operation, wallet/payment/payout/reward mutation, user-account mutation or service activation occurred. Mainnet remains untouched. Production remains NOT APPROVED.

## Final gate results for this workspace

- `npm run verify:static`: PASS (exit code 0) after the final source edits.
- `npm run prebuild:checks`: blocked at JSX duplicate-prop analysis because the `typescript` package is not installed in this workspace.
- `npm run typecheck` and `npm run lint`: their project pre-hooks correctly rejected the local Node `22.16.0` runtime; the repository requires Node `^24.15.0`.
- `npm run build`: blocked by the same Node runtime guard before Next.js compilation.
- `node_modules` is absent. A registry-backed clean install was not available in this execution environment.
