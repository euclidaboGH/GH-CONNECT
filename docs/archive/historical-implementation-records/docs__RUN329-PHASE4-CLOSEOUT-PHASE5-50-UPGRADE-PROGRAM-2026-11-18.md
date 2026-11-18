# RUN329 — Phase 4 source closeout and Phase 5 five-run / 50-upgrade programme

**Working baseline:** `GREENHAVEN-0.338.99-RUN328-PHASE4-IDENTITY-COMMUNITY-MESSAGING.zip`  
**Package:** `gh-connect@0.338.99` (no version bump in a source-only engineering run)  
**Disposition:** local source candidate only; no push, deployment or database mutation.  
**Decision:** Phase 4 source implementation is closed for the selected scope. Phase 5 begins with the RUN327–RUN331 programme below. Operational release remains blocked until every relevant external gate passes.

## 1. Phase 4 closeout — selected scope

The user selected all three Phase 4 tracks: (1) Identity & Authentication, (2) Community discussion/participation, and (3) Messenger community communications. The RUN328 implementation is additive to the existing canonical product surfaces.

### Source evidence rerun in RUN329

| Area | Gate | Result |
|---|---|---:|
| Identity integration | `check-phase4-identity-integration.mjs` | 17/17 |
| Identity/authentication | `check-phase4-identity-authentication.mjs` | 16/16 |
| Coordinated Phase 4 | `check-phase4-identity-community-messaging.mjs` | 32/32 |
| Community privacy/write boundaries | `check-phase4-social-community-boundaries.mjs` | 9/9 |
| Community canonical rendering/moderation | `check-phase4-community-completion.mjs` | 21/21 |
| Community pagination | `check-phase4-community-post-pagination.mjs` | 12/12 |
| Messenger community surface | `check-priority10-messenger-community.mjs` | 14/14 |
| Messenger Phase 1 closeout contracts | `check-priority10-phase1-closeout.mjs` | 19/19 |
| Held migration readiness | `test-held-migrations-readiness.mjs` | 6/6 source checks; PostgreSQL rehearsal still required |
| Phase 3 message idempotency | `check-phase3-messaging-idempotency.mjs` | 10/10 |
| Phase 2 atomic tally contract | `check-phase2-atomic-election-tally.mjs` | 20/20 |

**Phase 4 source disposition: CLOSED for the three selected source workstreams.** This is not a claim of live Testnet, production, or device acceptance. The Phase 4 SQL remains in `supabase/proposals/20261118_phase4_identity_group_contact.sql`; it is not an applied migration. Atomic session-cap remains opt-in and disabled until the SQL is rehearsed and approved. Community directory, group invitations and contact-share actions remain fail-closed if their canonical database dependencies are absent.

### External Phase 4 release blockers

- Supported Node `24.15.x` clean install, typecheck, lint, prebuild and production build.
- PostgreSQL parsing and disposable-database rehearsal for the held proposal.
- Exact Testnet and Mainnet schema/history reconciliation; no broad RLS grants or policies.
- Two-account positive/negative authorization tests for session rotation, member directory, invitations, blocks and own-profile sharing.
- Pi Browser and Android acceptance, including account switching, offline/reconnect and accessibility.

## 2. Phase 5 programme — exactly 10 major upgrades per run

The 50 items below are the programme backlog and acceptance contract. They are not represented as already implemented. RUN329 starts the programme with documentation, gates and source-level closeout. Each item must be independently evidenced; a UI-only change does not satisfy a server/data requirement.

### RUN327 — migration dependency review and disposable PostgreSQL rehearsal

1. **Canonical migration inventory:** fingerprint every migration/proposal by path, checksum, object families, classification and source revision; detect duplicate or renamed SQL.
2. **Dependency graph:** map table, enum, sequence, index, trigger, function, policy, storage and extension prerequisites into a deterministic topological order; fail on cycles/unresolved prerequisites.
3. **Object-level dependency audit:** inspect `SECURITY DEFINER`, `search_path`, function overloads, grants, triggers, FK targets, generated columns and referenced helper routines.
4. **RLS/grant matrix:** classify every table by intended browser/service role, RLS policy, table grant, RPC-only access and explicit deny; never add blanket policies to silence advisors.
5. **Clean-database rehearsal:** provision a disposable PostgreSQL 17 instance, apply the exact ordered migration set from empty state, and capture SQLSTATE, timing and resulting catalog fingerprints.
6. **Retry/idempotency rehearsal:** rerun only migrations designed to be safely repeatable; verify duplicate-object handling and prove non-idempotent scripts stop before corrupting state.
7. **Partial-failure recovery:** inject failure at transaction boundaries; verify rollback, migration history consistency and deterministic resume behavior.
8. **Target-history reconciliation:** compare source checksums and catalog objects independently against Testnet and Mainnet; record missing, divergent and unknown objects without auto-repair.
9. **Postflight security diff:** compare grants, RLS, policies, function ACLs, `search_path`, indexes, triggers and constraints before/after; reject privilege expansion.
10. **Signed migration release bundle:** produce ordered SQL, hashes, preflight assertions, postflight assertions, rollback/forward-repair notes and operator approval record; no automatic `db push`.

**Acceptance:** PostgreSQL 17 clean rehearsal, retry/failure injection, catalog/security diff and exact per-environment reconciliation all pass. No target migration is applied by this programme without separate explicit approval.

### RUN328 — election tally UI, agent submission and independent reconciliation

1. **Agent work queue:** show only contests and polling-unit assignments belonging to the authenticated active agent; no client-supplied actor identity.
2. **Verified geography picker:** use only active, versioned, source-attributed geographic records; disable manual arbitrary unit selection when authoritative data is unavailable.
3. **Accessible tally form:** candidate-by-candidate integer entry, registered/accredited/ballot counts, validation summaries and keyboard/screen-reader support.
4. **Offline-safe draft capture:** keep unsubmitted drafts local and visibly marked; never label a local draft as received or submitted; account-switch purge/fencing.
5. **Evidence attachment flow:** bind images/documents to the exact polling-unit submission, preserve original digest and custody events, keep unscanned evidence quarantined.
6. **Arithmetic and domain validation:** candidate sum, valid/rejected/total ballot, accreditation and registered-voter bounds enforced both client-side for feedback and server/database-side for authority.
7. **Concurrent/idempotent submission:** stable request identity, exact-payload replay, changed-payload conflict, advisory/unique serialization and atomic parent/child/audit write.
8. **Independent observer comparison:** compare distinct assigned agents' reports for the same canonical polling unit and disclose exact agreements/discrepancies; one agent cannot independently corroborate itself.
9. **Discrepancy review workflow:** preserve original submissions, append reviewer decisions and evidence, require reason codes, dual-control for material decisions and immutable audit events.
10. **Certification separation:** reconciliation is not official certification; only a separately authorized, legally defined process may certify results, with provenance and explicit operator accountability.

**Acceptance:** two or more independently assigned agents, exact replay/concurrency tests, discrepancy fixtures, offline recovery, evidence custody, and owner/reviewer authorization all pass. No election result is auto-certified.

### RUN329 — authoritative geographic datasets and evidence-scanner integration

1. **Source registry and provenance:** maintain source authority, jurisdiction, publication date, license/terms, retrieval timestamp, checksum and responsible reviewer per dataset.
2. **Normalized hierarchy:** country/state/LGA/ward/polling-unit hierarchy with stable IDs, parent integrity, country constraints and explicit level semantics.
3. **Code and alias registry:** preserve official codes, historical codes, multilingual names, transliteration and aliases without collapsing distinct places.
4. **Versioned import staging:** validate raw files in staging, produce row-level reject reports, deduplicate deterministically and require signed approval before activation.
5. **Geospatial integrity:** validate coordinate bounds, parent containment, duplicate coordinates, geometry validity and boundary-source consistency; do not infer missing official units.
6. **Change and deprecation lifecycle:** append source version changes, rename/merge/split/deactivate events; never silently reassign historical observations to a new geography.
7. **Bounded search and selection API:** authenticated, assignment-scoped, paginated geography search; return only necessary public fields; no unbounded country dump.
8. **Scanner provider adapter:** provider-neutral scan contract, explicit timeout/error/unsupported states, secret isolation, file-size limits and provider health checks.
9. **Authenticated scanner callback and retry queue:** verify HMAC/signature, timestamp/replay window, exact object digest and current scan lease; retry transient failures without marking clean.
10. **Quarantine and evidence release:** only provider-confirmed clean results can become eligible for review/delivery; suspicious, unsupported, timeout or unknown results remain quarantined; preserve chain-of-custody.

**Acceptance:** source provenance audit, deterministic import, hierarchy/geospatial validation, scanner contract tests, callback replay tests, infected/unknown/timeout fixtures and no release before clean verification.

### RUN330 — Feed, Community and Messaging transformations

1. **Canonical feed composition:** one shared post card/composer model across Feed/Profile/Community with no duplicate mutation owners or divergent post semantics.
2. **Engagement convergence:** reactions, comments, replies, reposts, quotes, saves and shares use canonical server aggregates, exact idempotency and honest pending/failure rollback.
3. **Feed ranking transparency:** Following/Latest chronological, For You explainable, privacy/block/mute filters before ranking, stable cursors and account-fenced requests.
4. **Creator/media reliability:** durable upload intents, cancellation, resumable recovery, media ownership, signed private delivery, captions/alt text and safe preview fallbacks.
5. **Community governance:** role-rechecked moderation, append-only reports/audit, pinned announcements, event/RSVP/resource lifecycle and member privacy boundaries.
6. **Community discovery and membership:** privacy-aware member directory, invite/join approval, membership state convergence, anti-enumeration and bounded search.
7. **Messenger conversation controls:** durable member-scoped mute/archive/pin/nickname/read-receipt preferences, request/accept flow and server-bound receipts.
8. **Group and contact consent:** invitation acceptance before membership, reciprocal block checks, exact-payload idempotency and explicit own-profile sharing only.
9. **Reliable notification/outbox delivery:** durable outbox, dedupe keys, retry/backoff, dead-letter inspection, preference enforcement and safe deep links.
10. **Real-time and accessibility hardening:** private channel authorization, lease-based presence, keyboard/screen-reader support, reduced motion, low-data Android/Pi Browser performance.

**Acceptance:** two-account/multi-device tests, stale-account fencing, visibility and block matrices, offline/reconnect, notification dedupe, accessibility audit and measured mobile performance.

### RUN331 — Marketplace upgrades and checkout acceptance

1. **Seller identity and trust:** verified seller profile, listing ownership, moderation state, risk flags and clear buyer-facing trust context.
2. **Listing quality and lifecycle:** normalized category/attribute schema, media provenance, condition, shipping constraints, duplicate detection and review states.
3. **Variants and inventory:** atomic SKU/variant reservation, stock bounds, concurrent checkout protection and expiry/release of abandoned reservations.
4. **Search and discovery:** canonical Unicode normalization, server-side filters/sorts, relevance explanations, cursor stability and privacy-safe saved searches.
5. **Cart integrity:** server-calculated totals, quantity/price snapshots, seller grouping, currency/rail separation and exact idempotency for cart mutations.
6. **Checkout orchestration:** quote expiry, inventory reservation, order/payment intent binding, replay protection and recoverable multi-step state transitions.
7. **Pi payment verification:** verified Pi SDK/server evidence only, amount/currency/order binding, duplicate callback protection and no client-authored paid status.
8. **Order lifecycle and fulfilment:** seller acceptance, dispatch, tracking, delivery evidence, cancellation windows and atomic transition guards.
9. **Refund/dispute/reversal workflow:** reason-coded requests, evidence retention, provider confirmation, partial/full refund accounting and no unilateral balance edits.
10. **Seller settlement and acceptance:** verified net proceeds, fees/commission, payout reservation/reconciliation, immutable ledger linkage and full buyer/seller two-account Testnet checkout matrix.

**Acceptance:** concurrent cart/inventory tests, payment replay/timeout tests, order transition matrix, refund/dispute recovery, seller net-proceeds reconciliation and end-to-end Testnet checkout. Mainnet remains disabled.

## 3. RUN329 work actually completed in this archive

- Reopened and integrity-tested the RUN328 source archive; no project database or deployment mutation was performed.
- Re-ran Phase 4 identity, community and messaging source gates listed above.
- Confirmed the existing Phase 2 atomic tally API and held SQL proposal remain server-authoritative and do not certify results.
- Reconfirmed that the research/evidence migrations and scanner dependencies require separate rehearsal/configuration; no unsupported geography seed or fake scanner result was introduced.
- Added this 50-upgrade programme as the coordinated acceptance register. The 50 work items are roadmap scope, not 50 completed code changes.

## 4. Environment and database evidence limits

The source workspace has Node `22.16.0`, no `node_modules`, no `psql`, no Supabase CLI and no Docker executable. Therefore no dependency-backed clean install/typecheck/lint/Next build or disposable PostgreSQL rehearsal can be claimed from this workspace.

A connected read-only migration-history query returned 45 recorded rows for one PostgreSQL 17.11 environment. A separate historical audit recorded 43 Testnet rows; these counts are not interchangeable and require exact environment/connection identification plus a fresh source-to-target reconciliation. The prior Mainnet query returned zero recorded rows, which does **not** prove an empty or clean Mainnet schema. No schema/catalog mutation is authorized by these observations. Mainnet remains untouched.

## 5. Non-negotiable boundaries

- Preserve GreenHaven and Pi Network branding/authentication.
- Keep wallet, PI/GHC balances, rewards, payments, payouts, seller proceeds and entitlements server-authoritative and canonical.
- Never use client input as actor identity or financial truth.
- No backend/auth/RLS bypasses, mock durable backends, fabricated geography, fake scan-clean state or fabricated election results.
- Keep all unverified services unavailable; all unknown/failed evidence quarantined.
- No migrations applied, no Supabase mutation, no payment/payout/reward/account mutation, no GitHub push and no Vercel deployment in this run.
- Production remains **NOT APPROVED** until independent source, database, runtime, Testnet, device and operator gates pass.
