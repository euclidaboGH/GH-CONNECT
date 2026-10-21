# GH-CONNECT — 10-Phase Global Beta Programme

## Purpose

A controlled programme for expanding GH-CONNECT without weakening account security, durable data, Pi payment verification, or the internal GHC ledger. Each phase must be measured and explicitly released; feature flags remain off until their own gates pass.

## Non-negotiable economy invariants

- The daily GHC claim has a **48 hours** pending-lock/claim lifecycle as defined by the authoritative ledger migrations; the client cannot manufacture or release a claim.
- The daily claim remains the **only issuance source** until the explicitly reviewed referral/curation redistribution paths are enabled by their approved migrations and server controls.
- Client UI state is never authoritative for balance, entitlement, payment completion, reward eligibility, or curation outcomes.
- Pi payments must be verified server-side and completed idempotently. Pi and GHC remain separate asset/payment rails unless a separately approved product defines otherwise.
- Production readiness requires clean dependency installation, TypeScript, lint, build, static regression, Testnet Pi Browser, two-account authorization, and migration reconciliation evidence.

## Ten phases

1. Source integrity, release metadata, environment and deployment configuration.
2. Authentication, session and route authorization.
3. Durable database operations, RLS and migration reconciliation.
4. Pi payment intent, verification, completion and recovery.
5. GHC ledger, reward issuance, spending and transfer integrity.
6. Media privacy, signed delivery, size/MIME and storage operations.
7. Social actions, messaging, notifications and cross-account privacy.
8. Marketplace, membership and seller order lifecycle.
9. Observability, operational recovery, accessibility and responsive QA.
10. Testnet evidence, staged release approval, rollback plan and monitored rollout.

A phase marked source-complete is not necessarily runtime-verified or production-ready. Never bulk-apply migrations or activate financial flags solely because source tests pass.
