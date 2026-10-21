# GH-CONNECT 0.63.25 — 10-Phase Stabilization and Global Launch Programme

**Baseline:** `0.63.25` from `GH-CONNECT-0.63.25-FULL-AUDIT-STABILIZATION-1.zip`  
**Mode:** surgical remediation; preserve existing product behavior unless a defect or approved requirement justifies change.  
**Release posture:** not production-certified until all applicable automated and live operator gates are evidenced.

## Operating rules

1. This archive is the only source baseline for this workstream. Do not merge older ZIPs or rely on older chat summaries as code evidence.
2. Work on a clean branch and keep a pristine copy of the baseline. Each phase must be a small, reviewable commit with a rollback path.
3. Do not apply migrations, change provider credentials, enable payout/reward flags, or deploy to production as part of a source-only audit.
4. Do not claim a feature is live because its UI, route, migration, adapter, or static test exists. Label each capability `implemented`, `automated-tested`, `Testnet-verified`, or `production-approved` separately.
5. Never enable financial or privacy-sensitive flows until authorization, idempotency, reconciliation, failure recovery, and operator evidence all pass.
6. No broad file moves until imports, scripts, CI workflows, deployment configuration, and documentation links have been checked. Reorganization begins with an index and stable ownership rules.

## Phase 1 — Establish a reproducible baseline

**Scope:** clean install, supported Node runtime, lockfile consistency, typecheck, lint, safety scan, production build, complete CI suite.

**Work:** run on Node `24.15.0` using `npm ci --legacy-peer-deps`; capture exact versions, commands, logs and exit codes. Resolve failures at source rather than masking compiler/linter/build errors. Keep dependency upgrades separate from functional repairs.

**Acceptance:** clean install succeeds; all required checks pass from a fresh checkout; no ignored build errors; artifact is reproducible; CI and local commands agree.

## Phase 2 — Reconcile project truth and release documentation

**Scope:** version markers, phase status, migration inventory, deferred features, test claims, release notes.

**Work:** maintain one status vocabulary; use generated migration inventory as the migration-count authority; reconcile historical phase reports without deleting history. Explicitly distinguish source coverage from live proof.

**Acceptance:** package, lockfile, runtime health marker, manifest, migration checklist, release guide, and current status report agree. All exceptions have an owner and resolution path.

## Phase 3 — Identity, access control and privacy

**Scope:** authentication/session lifecycle, object-level authorization, account boundaries, blocking, private profiles, export/deletion, administrative routes.

**Work:** test every read/write route for authentication, ownership, role checks, input validation and deny-by-default behavior. Run two-account IDOR matrices, including direct API calls and guessed identifiers. Review sensitive logs and data retention.

**Acceptance:** unauthorized cross-account access is denied at server/database layers; no client-only authorization; account export/deletion behavior is documented and verified; high-risk findings are fixed and regression-tested.

## Phase 4 — Database and migration safety

**Scope:** all canonical SQL migrations, RLS, grants, RPC signatures, indexes, transaction boundaries, data backfills and rollback plans.

**Work:** preserve the canonical migration directory. Classify every migration `REQUIRED`, `REQUIRES_APPROVAL`, `PROPOSAL`, or `REVIEW_REQUIRED`; inspect dependency order and historical naming. Apply only approved migrations to a disposable database first, then Testnet with recorded before/after evidence. Never bulk-apply proposals or use file counts as proof of live state.

**Acceptance:** clean database bootstrap and upgrade path are tested; RLS/grants/RPC ACLs verified; migration history matches the approved manifest; rollback/forward-recovery plan exists; no production migration without explicit operator approval.

## Phase 5 — Financial integrity: GHC, Pi and payouts

**Scope:** wallet ledger, daily claims, transfers, tips, creator rewards, memberships, marketplace settlement, Pi payment intents, provider callbacks and payout adapters.

**Work:** require authoritative server-side ledger writes, integer/minor-unit or explicitly bounded decimal arithmetic, idempotency keys, canonical locking, duplicate/replay protection, reconciliation and audit trails. Verify payer/recipient, amount, direction, network and transaction IDs against provider evidence. Keep unverified payout rails and reward issuance feature-gated/off.

**Acceptance:** same-event concurrency, insufficient-balance races, retries, partial failure and orphan recovery tests pass against PostgreSQL/Testnet; no client-controlled mint/settlement; provider and ledger reconciliation is repeatable; financial flags remain off until sign-off.

## Phase 6 — Media, messaging and real-time reliability

**Scope:** upload validation, private object access, signed URLs, CDN/storage migration, messaging delivery, realtime transport, notification links and multi-instance rate limits.

**Work:** verify authorization before issuing URLs; enforce file size/type/content validation and safe image processing; test expired/revoked links and cross-user access. Exercise message retries, deduplication, ordering assumptions, offline recovery and deep links. Replace process-local limits with a distributed limiter only through an approved design and test plan.

**Acceptance:** private media cannot be fetched by unauthorized users; no public raw storage paths leak for private content; messaging recovery is durable across instances; rate limits have a defined shared enforcement boundary; storage cutover has rollback and integrity checks.

## Phase 7 — Product UX, accessibility and global readiness

**Scope:** onboarding, navigation, feed, search/discovery, communities, profile, creator tools, marketplace and wallet/payment flows.

**Work:** map core user journeys and remove contradictory or placeholder UI that implies a working backend. Test mobile and desktop layouts, keyboard navigation, screen readers, reduced motion, loading/empty/error states, low-bandwidth behavior, localization/time zones and network failure recovery. Do not add features solely to fill roadmap gaps.

**Acceptance:** critical journeys have automated end-to-end coverage; no dead-end controls or misleading success states; accessibility and responsive checks pass; translations, currencies and legal disclosures are explicit where needed.

## Phase 8 — Architecture, code quality and developer ergonomics

**Scope:** duplicated services, feature boundaries, typed contracts, validation, error handling, logging, tests, dead code and repository navigation.

**Work:** define canonical ownership for identity, social actions, messaging, discovery, media and economy. Refactor incrementally with behavior-preserving tests. Add module-level docs where non-obvious; remove code only after reference and runtime checks. Reorganize documentation through indexes before moving source files.

**Acceptance:** each domain has a documented source of truth; imports are acyclic where practical; public/server/client boundaries are clear; errors are typed and sanitized; source cleanup has regression coverage; a new engineer can find feature code, migrations, tests and operations quickly.

## Phase 9 — Operations, observability and incident readiness

**Scope:** health/readiness checks, structured logs, metrics, alerting, secrets, backups, restore drills, incident response, deployment rollback and provider outages.

**Work:** define service-level indicators for auth, API errors, database latency, payment completion, reconciliation lag, media failures and message delivery. Redact secrets/PII; verify backups and restore procedures; document key rotation, provider outages, incident escalation and safe feature shutdown.

**Acceptance:** alerts are actionable; secrets are not in source/client bundles/logs; backup restore and rollback are exercised; operators can disable affected financial/media features without a full deployment; incidents leave an auditable trail.

## Phase 10 — Controlled Testnet beta and launch approval

**Scope:** production-like deployment, operator evidence, user acceptance, security review and release sign-off.

**Work:** run migrations in the approved order on Testnet, two-account authorization tests, Pi Browser E2E, financial concurrency and reconciliation, private-media checks, mobile/desktop smoke tests, provider outage drills and load tests. Track every failed gate as a blocker with an owner and retest evidence. Mainnet uses separate credentials and explicit approval.

**Acceptance:** all critical gates are green with dated evidence; no unresolved critical/high security or financial-integrity defects; rollback and incident contacts are ready; privacy/legal disclosures and support processes are reviewed; release owner signs the launch decision. Passing source tests alone is insufficient.

## First execution batch — source-only, low-risk changes

1. Add the documentation map and engineering change-control rules.
2. Re-run existing source integrity, dependency-lock, migration inventory, release hygiene and safety scripts.
3. Run targeted baseline, financial/media readiness, payout-adapter and release-readiness tests.
4. Attempt the clean dependency install and full typecheck/lint/build only in a supported environment; preserve logs and report any unavailable network/runtime prerequisites.
5. Do not apply migrations or activate live integrations during this batch.

## Current evidence from this archive

The following checks were executed against the extracted archive and passed:

- `scripts/audit-project-integrity.mjs`: 36 checks, 0 errors, 0 warnings.
- `scripts/check-dependency-lock-integrity.mjs`: passed.
- `scripts/generate-migration-inventory.mjs --check`: 109 canonical migrations; current conservative classification is 77 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 29 REVIEW_REQUIRED; generated docs synchronized. Phase 3 additionally hardens durable step-up/session revocation and adds a 141-script source regression sweep (141/141 passed); remote migration history remains unverified.
- `scripts/check-release-hygiene.mjs`: 11/11 passed.
- `scripts/scan-production-safety.mjs`: 21/21 passed.
- `scripts/test-10-phase-baseline.mjs`: 8/8 passed.
- `scripts/test-phase19-financial-media-readiness.mjs`: 29/29 passed.
- `scripts/test-phase20-payout-adapters.mjs`: 19/19 passed.
- `scripts/test-stage7-release-readiness.mjs`: 23 assertions passed.

These are source/static checks only. Dependencies were not installed in this audit workspace, so TypeScript, ESLint, Next production build, browser E2E, PostgreSQL concurrency, Supabase Testnet and Pi Browser checks remain unverified.

## Launch blockers to close before declaring production-ready

- Clean dependency install + typecheck + lint + production build on supported Node.
- Complete `npm run ci:verify` and preserve logs; investigate any failure rather than weakening the gate.
- Disposable PostgreSQL migration bootstrap/upgrade, RLS/grant/RPC ACL checks and concurrency tests.
- Supabase Testnet migration-history reconciliation and operator evidence.
- Two-user IDOR/social/messaging matrix and private-media access checks.
- Pi Browser auth/payment/membership E2E using Testnet-only credentials.
- Provider callback replay, idempotency, reconciliation, outage and recovery evidence.
- Load/performance, accessibility, backup restore, monitoring/alerting and rollback drills.
- Explicit review of all `REVIEW_REQUIRED`, `REQUIRES_APPROVAL`, and proposal migrations.

## Definition of done

A phase is complete only when its code/documentation changes, automated tests, operator evidence (where applicable), residual risks, rollback notes and reviewer sign-off are recorded. A green static suite never silently upgrades a feature to live-verified or production-approved.
