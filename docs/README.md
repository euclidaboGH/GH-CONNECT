# GH-CONNECT Documentation Index

Use these current references first. Older implementation logs and dated audits are kept under [`archive/`](archive/) for traceability and are not release authority.

## Source and release truth

- [`PROJECT_TRUTH.md`](PROJECT_TRUTH.md) — current source version, latest known CI/build status, release gates.
- [`PHASE_IMPLEMENTATION_STATUS.md`](PHASE_IMPLEMENTATION_STATUS.md) — status vocabulary and distinction between source and live verification.
- [`TESTNET_VERIFICATION_GATE.md`](TESTNET_VERIFICATION_GATE.md) — operator Testnet checks.
- [`E2E_AND_MAINNET_READINESS.md`](E2E_AND_MAINNET_READINESS.md) — runtime and release readiness requirements.
- [`MIGRATION_CHECKLIST.md`](MIGRATION_CHECKLIST.md) — generated migration inventory, not proof of remote application.
- [`REMOTE_MIGRATION_RECONCILIATION.md`](REMOTE_MIGRATION_RECONCILIATION.md) — reconcile target schema/history before applying migrations.
- [`DEFERRED_AND_GATED.md`](DEFERRED_AND_GATED.md) — intentionally deferred or disabled functionality.
- [`PRODUCTION_OPS.md`](PRODUCTION_OPS.md) and [`ROLLBACK_RUNBOOK.md`](ROLLBACK_RUNBOOK.md) — operations and recovery.

## Security and identity

- [`AUTH-SECURITY-DOMAIN.md`](AUTH-SECURITY-DOMAIN.md)
- [`PI-IDENTITY-BRIDGE.md`](PI-IDENTITY-BRIDGE.md) and [`PI_RUNTIME_AND_AUTH_LIFECYCLE.md`](PI_RUNTIME_AND_AUTH_LIFECYCLE.md)
- [`IDOR_TEST_CHECKLIST.md`](IDOR_TEST_CHECKLIST.md)
- [`SECURITY_AUDIT_HARDENING_2026-10-21.md`](SECURITY_AUDIT_HARDENING_2026-10-21.md) — dated audit notes; verify against current code.

## Product and architecture domains

- Social graph, engagement, attention, curation, notifications, search and reputation: `GH_*.md` and `GREENHAVEN_REPUTATION_CURATION_POLICY.md`.
- Media, private storage and messaging: [`GH_MEDIA.md`](GH_MEDIA.md), [`MEDIA_PRIVATE_BUCKET.md`](MEDIA_PRIVATE_BUCKET.md), [`MEDIA_STORAGE_OPERATOR.md`](MEDIA_STORAGE_OPERATOR.md), [`CLOUDFLARE_R2_GLOBAL_MEDIA_ARCHITECTURE.md`](CLOUDFLARE_R2_GLOBAL_MEDIA_ARCHITECTURE.md).
- GHC economy and payment boundaries: [`GHC_PRODUCTION_PERSISTENCE.md`](GHC_PRODUCTION_PERSISTENCE.md), [`ECONOMY_V12_MIGRATION_SAFETY.md`](ECONOMY_V12_MIGRATION_SAFETY.md), [`VALUE_SYSTEM_ARCHITECTURE.md`](VALUE_SYSTEM_ARCHITECTURE.md), and `STAGE_*` / `PHASE_*` domain documents.
- Release evidence: [`evidence/README.md`](evidence/README.md).

## Historical reports

`archive/` contains superseded reports for audit traceability. Their assertions, counts, and test results apply only to the source revision and date stated in each report.
