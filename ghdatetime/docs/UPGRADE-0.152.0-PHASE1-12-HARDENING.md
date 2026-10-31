# GreenHaven v0.152.0 — Phase 1–12 Hardening Upgrade (superseded by v0.153.0)

## Release intent

This historical release began the requested 10-upgrades-per-phase programme with a cross-phase safety pass. It is superseded by v0.153.0. It makes three concrete source changes and adds regression contracts for each changed area. It does not claim that all 120 planned product-level enhancements are finished; those require phase-specific implementation and runtime acceptance rather than being represented as complete by documentation alone.

## Implemented in this release

### Identity hydration (Phase 3)
1. Added a five-second timeout to the upstream public-profile request so a stalled identity service cannot hold up a feed indefinitely.
2. Rejected protocol-relative photo URLs (`//host/path`) so they cannot be interpreted as external network-path references.
3. Rejected backslash-containing and control-character photo values before returning a public photo URL.
4. Added source regression checks for the timeout and photo URL boundaries.

### Navigation event payloads (Phase 6)
5. Reject destination strings longer than 100 characters before resolving them.
6. Bound externally sourced group, listing, and user identifiers before dispatching app-shell events.
7. Bound chat display names, photo values, and service focus identifiers before event dispatch.
8. Added regression checks for destination and payload bounds.

### Pi transaction history (Phase 9)
9. Reject a persisted Pi transaction row when a supplied amount is non-numeric, non-finite, or negative instead of rendering the row with its amount silently omitted.
10. Added a regression assertion for malformed-amount rejection and kept the GHC and Pi rails separate.

## 10-upgrade workstreams for each phase

The following are the ten upgrade tracks to execute and accept independently in each phase. The items are work packages, not a claim that all product features below have already been implemented by v0.152.0.

### Phase 1 — Foundation and security
1. Verify environment schema at startup.
2. Add configuration drift detection.
3. Standardize structured server logs with redaction.
4. Add correlation IDs to request flows.
5. Enforce consistent API error envelopes.
6. Audit secure cookie and session defaults.
7. Expand security-header regression coverage.
8. Add dependency and lockfile drift checks.
9. Verify health/readiness separation.
10. Add reproducible clean-install and build evidence.

### Phase 2 — Canonical identity
1. Audit canonical identity uniqueness.
2. Validate identity input lengths and formats.
3. Add missing-identity recovery diagnostics.
4. Verify referral attribution ownership.
5. Add duplicate-attribution idempotency coverage.
6. Add identity lookup failure metrics.
7. Audit legacy identity fallback paths.
8. Add canonical identity migration coverage.
9. Verify privacy-safe identity projections.
10. Add cross-feature identity contract tests.

### Phase 3 — Public profile hydration
1. Bound upstream response time (implemented).
2. Reject unsafe photo URL forms (implemented).
3. Add response-body size bounds.
4. Validate returned profile row shapes.
5. Add hydration batch-size boundary tests.
6. Add duplicate-ID behavior tests.
7. Add malformed JSON fallback tests.
8. Add upstream status/timeout regression tests.
9. Verify no private profile columns are selected.
10. Add feed/post/comment/story parity tests.

### Phase 4 — Recovery and release controls
1. Validate restore evidence schema.
2. Reject symlinked recovery artifacts.
3. Bound recovery subprocess duration.
4. Require disposable-database restore evidence.
5. Verify restore catalog completeness.
6. Add interrupted-restore cleanup tests.
7. Add evidence freshness checks.
8. Prevent production-target defaults in drills.
9. Add operator sign-off fields.
10. Document rollback and recovery ownership.

### Phase 5 — Design system
1. Audit semantic color usage.
2. Normalize spacing token adoption.
3. Verify minimum interactive target sizes.
4. Add reduced-motion regression coverage.
5. Audit keyboard focus visibility.
6. Standardize loading skeleton behavior.
7. Standardize empty and error states.
8. Check responsive gutters on key screens.
9. Remove conflicting legacy token definitions where safe.
10. Add visual regression evidence for critical surfaces.

### Phase 6 — Navigation and onboarding
1. Bound destination strings (implemented).
2. Bound event payload values (implemented).
3. Test deep links on cold start.
4. Test URL state/hash preservation.
5. Verify unknown-route recovery.
6. Test keyboard focus after route recovery.
7. Verify onboarding gate consistency.
8. Test session-lock state preservation.
9. Audit service registry destinations.
10. Add shell-level navigation journey coverage.

### Phase 7 — Social reliability
1. Verify fail-closed mute filtering.
2. Enforce streamed story body limits.
3. Test oversized and malformed JSON requests.
4. Verify author and viewer visibility rules.
5. Add upstream timeout coverage.
6. Test duplicate social action idempotency.
7. Verify pagination cursor validation.
8. Add empty/error/loading state parity.
9. Audit user-block and mute interaction ordering.
10. Add social API rate-limit regression coverage.

### Phase 8 — Wallet reliability
1. Validate wallet snapshot shape.
2. Prevent stale refresh overwrite.
3. Preserve stale-state indication after failure.
4. Reject mixed-rail history records.
5. Test zero, negative, and non-finite balances.
6. Add wallet refresh concurrency tests.
7. Verify no optimistic balance mutation on failed writes.
8. Audit currency formatting and precision.
9. Test empty and partial wallet responses.
10. Add accessible wallet loading/error states.

### Phase 9 — Transaction integration
1. Reject malformed supplied Pi amounts (implemented).
2. Validate currency and payment rail.
3. Validate transaction and provider identifiers.
4. Preserve missing timestamps as missing.
5. Verify user-scoped history reads.
6. Verify reconciliation is read-only.
7. Test malformed purpose metadata.
8. Test completed-but-unfulfilled records.
9. Verify ownership mismatch rejection.
10. Test duplicate and out-of-order provider events.

### Phase 10 — Marketplace and fulfilment
1. Keep durable order state authoritative.
2. Derive prices server-side.
3. Test idempotent order creation.
4. Test concurrent inventory reservation.
5. Normalize order timestamps.
6. Update cache only after durable writes.
7. Preserve buyer/seller authorization.
8. Separate payment from fulfilment state.
9. Test refund and cancellation transitions.
10. Add order-state transition matrix coverage.

### Phase 11 — Cross-feature reconciliation
1. Scope reconciliation to the authenticated user.
2. Keep GHC and Pi rails distinct.
3. Disclose the 100-record processing limit.
4. Surface possible truncation.
5. Validate supported order mappings.
6. Validate supported membership mappings.
7. Mark unsupported mappings unverified.
8. Test duplicate references.
9. Test records beyond the current limit.
10. Add pagination acceptance criteria before claiming complete coverage.

### Phase 12 — Release readiness
1. Keep release versions synchronized.
2. Verify static-suite registration.
3. Reject stale nested project copies.
4. Run clean-install verification on supported Node.
5. Run TypeScript checks.
6. Run lint checks.
7. Run production build.
8. Run browser and accessibility journeys.
9. Run disposable PostgreSQL restore and migration verification.
10. Require explicit financial/Testnet and production release approval.

## Verification boundaries

The source-level regression checks do not prove runtime behavior against Supabase, PostgreSQL, Pi Testnet, or production. Do not deploy based only on this source archive. Run the release acceptance workflow on Node.js 24.15.0 and attach runtime/operator evidence before production use.
