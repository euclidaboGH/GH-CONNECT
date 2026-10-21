# GH-CONNECT Documentation Index

- [Stabilization Phases 1–2 revisit](../STABILIZATION-PHASE-1-2-REVISIT-IMPLEMENTATION-REPORT.md) — build/dependency gates and current project-truth reconciliation.
- `PHASE_5_6_MASSIVE_HARDENING.md` — Phase 5–6 financial, media and messaging hardening follow-up.

Use this page to find the current engineering source of truth. Historical reports are retained as an audit trail; newer status documents do not retroactively make old test results current.

## Start here

1. [`PROJECT_TRUTH.md`](./PROJECT_TRUTH.md) — current source version, verification truth, release boundaries, and migration policy.
2. [`PHASE_IMPLEMENTATION_STATUS.md`](./PHASE_IMPLEMENTATION_STATUS.md) — source implementation vs automated vs runtime vs production status.
3. [`engineering/10_PHASE_GLOBAL_LAUNCH_REMEDIATION_PLAN.md`](./engineering/10_PHASE_GLOBAL_LAUNCH_REMEDIATION_PLAN.md) — current 10-phase remediation and global launch gates.
4. [`engineering/REPOSITORY_MAP.md`](./engineering/REPOSITORY_MAP.md) — repository structure and safe organization policy.
5. [`MIGRATION_CHECKLIST.md`](./MIGRATION_CHECKLIST.md) — generated migration inventory and classifications.
6. [`DEFERRED_AND_GATED.md`](./DEFERRED_AND_GATED.md) — features intentionally unavailable or gated.
7. [`TESTNET_VERIFICATION_GATE.md`](./TESTNET_VERIFICATION_GATE.md) — live verification still required.

## Product domains

- **Identity and security:** `AUTH-SECURITY-DOMAIN.md`, `PI-IDENTITY-BRIDGE.md`, `IDOR_TEST_CHECKLIST.md`
- **Social, feed and engagement:** `GH_SOCIAL_GRAPH.md`, `GH_SOCIAL_ENGAGEMENT.md`, `GH_ATTENTION.md`, `GH_CURATION.md`, `GH_NOTIFICATIONS.md`
- **Creator and reputation:** `GH_CREATOR_STUDIO.md`, `GH_REPUTATION.md`, `GREENHAVEN_REPUTATION_CURATION_POLICY.md`
- **Search and discovery:** `GH_SEARCH.md`, `PRODUCT_CLARITY.md`
- **Phase 6 — Media, messaging and real-time:** `PHASE_6_MEDIA_MESSAGING_REALTIME.md`
- **Phase 7 — World-class product experience:** `PHASE_7_WORLD_CLASS_PRODUCT_EXPERIENCE.md` — feed interaction, durable media galleries, accessibility, and responsive visual consistency.
- [Phase 8 — Architecture and Code Quality](PHASE_8_ARCHITECTURE_AND_CODE_QUALITY.md)
- [Phase 7–8 Massive Rework — Product Experience and Architecture](PHASE_7_8_MASSIVE_REWORK.md)
- [Phase 9 — Operations and Resilience](PHASE_9_OPERATIONS_AND_RESILIENCE.md)
- [Phase 10 — Testnet Beta and Launch Approval](PHASE_10_TESTNET_BETA_LAUNCH_APPROVAL.md)
- [Testnet release evidence packet and validator](evidence/README.md)
- [Roadmap After Phase 10](NEXT_ROADMAP_AFTER_PHASE10.md)
- **Media and messaging:** `GH_MEDIA.md`, `CLOUDFLARE_R2_GLOBAL_MEDIA_ARCHITECTURE.md`, `MEDIA_STORAGE_OPERATOR.md`, `ESSENTIAL_20_DURABLE_DM_MEDIA_2026-10-20.md`
- **GHC economy and payments:** `GHC_PRODUCTION_PERSISTENCE.md`, `ECONOMY_V12_MIGRATION_SAFETY.md`, `STAGES_3_5_ECONOMY_FOUNDATION.md`, `STAGE_2_DATABASE_FINANCIAL_INTEGRITY.md`, `STAGE_6_PI_FUNDED_GHC_ACQUISITION.md`, `GH_WITHDRAWAL_PI_SETTLEMENT.md`
- **Phase 5 financial integrity:** `PHASE_5_GHC_PI_FINANCIAL_INTEGRITY.md` — GHC ledger, durable Pi payments, membership settlement, creator/seller payouts, Paystack gates, and remaining verification requirements.
- [Phase 5 payment-intent post-migration assertions](../supabase/tests/PHASE5_PAYMENT_INTENT_POST_MIGRATION_ASSERTIONS.sql) and [concurrency test plan](../supabase/tests/PHASE5_PAYMENT_INTENT_CONCURRENCY_TEST_PLAN.md) — review and execute only on disposable PostgreSQL/Testnet after migration-history reconciliation.
- **Release and operations:** `PRODUCTION_READINESS_GATE_2026-10-18.md`, `E2E_AND_MAINNET_READINESS.md`, `PRODUCTION_OPS.md`, `ROLLBACK_RUNBOOK.md`, `OPERATOR_ENV_AND_STATUS.md`

## Audit and historical reports

Files named `*_AUDIT*`, `*_IMPLEMENTATION_REPORT*`, `HARDEN_PASS_*`, and dated phase reports record evidence at a particular point in time. Check their date and confirm the current tree and status document before relying on their claims.

## Documentation rules

- Mark each claim as source implementation, automated test, Testnet/runtime verification, or production approval.
- Date evidence and include the exact command, environment and result for important release gates.
- Keep historical reports rather than silently rewriting history; add a superseding report when conclusions change.
- Keep migration classifications and counts generated from the canonical migration directory.
- Do not claim launch readiness while a critical gate is unknown or unverified.
- [Phase 9–10 release-evidence rework report](PHASE_9_10_RELEASE_EVIDENCE_REWORK.md)
