# GH-CONNECT 0.274.3 — Pre-GitHub Comprehensive Audit and 100-Feature Roadmap

**Audit date:** 2026-11-02  
**Source baseline:** `GH-CONNECT-0.274.3-PI-WALLET-PHASE-3-WITHDRAWAL-RECOVERY-2026-11-02.zip`  
**Decision:** **NOT APPROVED for production / GitHub release gate not yet complete.** Source-level checks pass, but this runtime cannot run the supported Node 24 dependency install, TypeScript, lint or production build. No database credentials were available and no migration was applied.

## Scope and method

Read-only inventory and source-contract review across application routes, React components, feature modules, server/domain code, package scripts and lockfile, CI workflow, migration source files and manifests, release documents, and existing regression checks. Existing targeted tests were reused; no test was weakened to make the suite pass. The current tree contains 1,623 files, 218 API route files, 176 canonical Supabase migrations, 190 component files, 32 feature files, 471 `lib` files, 159 documentation files, and 252 scripts at the time of inventory (the exact full-tree count changes when this report/checker is added).

## Confirmed source-level findings

1. Package, lockfile and lock root version agree at `0.274.3`.
2. `.nvmrc`, package engine and CI runtime target Node `24.15.0`; the current local runtime is Node `22.16.0`, which is unsupported for this project.
3. CI uses locked dependency installation and contains static verification, typecheck, lint and production build gates.
4. The 176 canonical migration filenames have unique 14-digit versions; the source manifest and review bundle are synchronized.
5. The legacy canonical installer remains stale and explicitly marked `STALE / DO NOT EXECUTE`; it must not be used as a clean installer.
6. Static RLS review reports 137 executable application table names with explicit RLS enablement; 124 tables have policies and 13 are allowlisted for operator/service-role review. This is not proof of deployed database grants or RLS behavior.
7. Static SECURITY DEFINER review covers 371 declarations for a hardened search path and PUBLIC execute revocation. Effective deployed grants, overloads, ownership, and exploitability still require database catalog review.
8. No real `.env` secret file was found in the project tree; `.env.example` is allowed.
9. The PI wallet Phase 1–3 work is source-level only: identity reconnection, eligibility controls, user-scoped withdrawal status, safer errors, idempotency-key retention and unresolved-request blocking are covered by focused checkers. No live Pi authentication or payment was performed.
10. `scripts/check-pre-github-audit.mjs` was added and registered at the start of `prebuild` and `verify:static`. It is read-only and checks release inventory/metadata, migration naming, stale installer labeling, CI gates, env-file hygiene and presence of core project domains.

## Verification evidence gathered

- `npm run verify:static`: **passed** on the current Node 22 runtime. This suite is source-only and does not replace the runtime checks below.
- New pre-GitHub audit guard: **10/10 passed**.
- Dependency lock integrity: passed.
- Migration source manifest: **176/176 synchronized**.
- Consolidated migration bundle: **176/176 byte-for-byte synchronized**.
- Project truth: **10/10 passed**.
- Migration release readiness: passed; it explicitly warns that file order does not establish applied status.
- Clean migrations: passed; 176 unique 14-digit SQL migration filenames.
- Static RLS coverage: passed; 137 table names checked, 13 no-policy tables allowlisted for manual review.
- SECURITY DEFINER ACL source audit: passed for 371 declarations; deployed catalog still needs independent verification.
- Release hygiene: **11/11 passed**.
- Security headers: **7/7 passed**.
- API CSRF contract: **7/7 passed**.
- Pi backend lock verification: passed.
- CI governance: **16/16 passed**.
- PI withdrawal status/recovery: **16/16 passed**.
- PI wallet action wiring: **13/13 passed**.
- Phase 1 identity reconnect: **13/13 passed**.
- Wallet authorization: **13/13 passed**.
- Earnings dashboard: **13/13 passed**.
- Wallet refresh stability: **10/10 passed**.
- Marketplace checkout integrity: **16/16 passed**.
- Story experience integrity: **20/20 passed**.

### Checks deliberately not claimed as passing

- `npm ci --legacy-peer-deps`, because the available runtime is Node `22.16.0` and the project requires `24.15.0`.
- `npm run typecheck`, `npm run lint`, and `npm run build`, because the supported runtime/dependencies are not installed in this environment.
- SQL execution against disposable PostgreSQL, live Supabase schema/grant/RLS inspection, migration history reconciliation, two-user privacy tests, Pi Browser login, Testnet payout/provider receipt tests, or financial concurrency tests.

## Surgical changes made in this audit pass

- Added `scripts/check-pre-github-audit.mjs` as an early, read-only source-integrity gate.
- Registered the gate at the beginning of `prebuild` and `verify:static` so version drift, migration naming problems, missing CI gates, stale-installer warnings, or unexpected env files are caught earlier.
- No runtime dependencies were added or upgraded. No SQL migration, payout flag, database, identity, or payment behavior was changed in this audit pass.

## 100-feature coverage roadmap — ten sections, ten features each

These are prioritized feature candidates for staged implementation and acceptance, **not a claim that all 100 have already been implemented**. They must be delivered in reviewable batches with tests and feature-specific authorization. Existing capabilities should be preserved, not duplicated.

### Phase 1 implementation status

Implementation started in `docs/ROADMAP-PHASE-1-IDENTITY-ONBOARDING-PROFILE-2026-11-02.md`. Items are distinguished as implemented, intentionally deferred for security, or requiring a reviewed backend contract; the 10 candidates are not all claimed as complete.

### 1. Identity, onboarding and profile
1. Explicit identity/session status panel.
2. Account-switch confirmation when a different Pi UID authenticates.
3. Session-expiry recovery that preserves non-sensitive form drafts.
4. Profile completeness checklist with accessible progress.
5. Duplicate-account and identity-conflict operator queue.
6. Export personal profile data.
7. Self-service session revocation for other devices.
8. Profile visibility preview for each audience.
9. Field-level privacy controls with server-enforced parity.
10. Identity audit trail with redacted, user-readable events.

### 2. Feed, posts and social graph
1. Server-confirmed post status and retry action.
2. Draft recovery after reload or network loss.
3. Stable cursor pagination with duplicate suppression.
4. Per-post audience preview before publishing.
5. Block/mute impact preview before confirmation.
6. Edit history for eligible posts.
7. Report-post flow with reason categories and receipt.
8. Saved-post collections.
9. Feed preference controls with reset-to-default.
10. Cross-device reaction/comment reconciliation.

### 3. Messaging and communication
1. Durable send receipt and delivery-state explanation.
2. Idempotent retry UI for ambiguous send failures.
3. Message edit/delete policy and audit display.
4. Conversation search with server-side access checks.
5. Unread counts reconciled against durable state.
6. Attachment scan/status visibility.
7. Per-conversation mute and notification schedule.
8. Block/report from conversation details.
9. Export conversation data subject to policy.
10. Accessible offline queue with explicit pending/sent/failed states.

### 4. Communities and governance
1. Join-request queue for private communities.
2. Clear role/capability matrix in the UI.
3. Moderator action receipts and appeal path.
4. Membership-aware post and media preview.
5. Community rules acknowledgement versioning.
6. Member invitation expiry and revoke controls.
7. Community event RSVP and reminder workflow.
8. Governance poll quorum/result transparency.
9. Spam and abuse reporting with operator queue.
10. Community data export and owner handover workflow.

### 5. Marketplace, cart and checkout
1. Listing freshness indicator and refresh-before-checkout.
2. Seller verification state with evidence provenance.
3. Saved searches and alert preferences.
4. Price/stock change confirmation at checkout.
5. Order timeline with authoritative state transitions.
6. Cancellation/refund request workflow with eligibility reasons.
7. Seller response-time and fulfillment metrics with anti-gaming rules.
8. Dispute evidence upload and immutable case timeline.
9. Delivery/pickup handoff confirmation.
10. Accessible receipt/invoice export with server-authoritative totals.

### 6. Wallet, Pi identity and GHC economy
1. Wallet balance freshness timestamp and source status.
2. Clear available/locked/pending/ledger reconciliation view.
3. Withdrawal eligibility checklist with specific blocking reasons.
4. Request idempotency and recovery receipt UI.
5. User-scoped withdrawal history and dispute/report action.
6. Fee preview with gross, fee and net amount confirmation.
7. Session/identity re-verification for sensitive wallet actions.
8. Downloadable wallet activity statement.
9. Explicit testnet/mainnet environment banner and network identity.
10. Reconciliation exception workflow that never fabricates balances or marks uncertain payments paid.

### 7. Media, stories and private assets
1. Upload progress with cancel/retry support.
2. Server-confirmed publication status.
3. Private-media authorization preview.
4. Signed URL refresh with expired-link recovery.
5. Per-story audience and expiry preview.
6. Alt-text prompt and media accessibility checks.
7. Video size/duration constraints before upload.
8. Duplicate upload detection by durable asset identity.
9. Media deletion lifecycle with consumer-reference audit.
10. Storage retention and orphaned-asset reporting.

### 8. Notifications and real-time updates
1. Per-category notification preferences.
2. Read/unread state reconciliation across devices.
3. Push subscription status and permission recovery.
4. Realtime connection diagnostics without secrets.
5. Backoff and reconnect visibility for stale panels.
6. Notification deduplication by stable event ID.
7. Deep links that validate access before opening content.
8. Quiet hours and digest mode.
9. Notification retention/export controls.
10. Dead-letter/retry metrics for operator-only diagnostics.

### 9. Navigation, accessibility and resilience
1. Keyboard-only end-to-end navigation tests.
2. Screen-reader announcements for async actions.
3. Reduced-motion behavior audit across overlays.
4. Consistent loading/empty/error/retry states for every route.
5. Offline mode that labels unavailable features accurately.
6. Deep-link route restoration with authorization recheck.
7. Safe-area and virtual-keyboard coverage on mobile.
8. Responsive layout tests for phone/tablet/desktop.
9. Global action search with permission-aware results.
10. Error correlation IDs visible to users without leaking stack traces.

### 10. Admin, security, operations and release engineering
1. Read-only deployment health dashboard.
2. Migration diff/history reconciliation report per environment.
3. RLS and effective-grant catalog evidence capture.
4. SECURITY DEFINER overload/owner/grant reconciliation.
5. Financial invariant and ledger conservation test harness.
6. Provider webhook signature/replay test suite.
7. Operational runbooks for stuck/uncertain payment states.
8. Secret scanning and dependency vulnerability review in CI.
9. Accessibility/performance budgets enforced in CI.
10. Signed release evidence bundle with commit, checksums, test results and operator approvals.

## Recommended execution order

1. Complete supported-runtime install, typecheck, lint and build first.
2. Fix all reproducible compiler, lint and build errors without downgrades or disabling checks.
3. Reconcile Testnet migration history and review every non-`REQUIRED` migration classification individually.
4. Complete live identity/media/social privacy and wallet/marketplace financial E2E tests.
5. Deliver the 100-feature roadmap in small domain batches; do not combine unrelated schema or payment changes into one risky release.
6. Create a final GitHub-ready archive only after checks are green and a reviewer can reproduce the results.

## Release conclusion

This audit adds an early source-integrity gate and records current evidence and remaining gaps. It is not a production approval. The project must not be promoted based solely on static contract tests, and no migration should be bulk-applied from the consolidated review bundle.
