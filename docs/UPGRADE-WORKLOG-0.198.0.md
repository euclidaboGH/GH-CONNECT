# GreenHaven upgrade worklog — v0.198.0 / Phase 21

## Scope

Added an append-only, database-authored marketplace order lifecycle event journal. The journal records order creation and changes to payment, order, delivery, escrow and dispute states, linked to the canonical `gh_marketplace_orders` row. Event rows retain before/after lifecycle state, timestamp and best-effort actor attribution (`authenticated_claim`, `service_context`, or `unknown`). Client access is denied by RLS; update/delete attempts are rejected by a database trigger.

## Important boundaries

- This is an audit-history foundation, not a refund processor, chargeback workflow, dispute adjudication engine, payout reversal ledger or settlement mechanism.
- Event actor attribution is not guaranteed to identify the human operator. Calls made through a service-role connection may have no authenticated user claim and are explicitly labeled as service context or unknown.
- The event journal does not replace the order row, payment intent, verified provider evidence, immutable seller-net snapshot, community entitlement or treasury journal. Those remain separate authoritative domain records joined by stable IDs.
- Migration `20261030010010_phase21_marketplace_case_event_journal.sql` is `REVIEW_REQUIRED` and has not been applied to Testnet or production.
- Validate trigger ordering against all order mutation paths, claim propagation, event coverage, RLS, append-only behavior, concurrency and index performance on disposable PostgreSQL before Testnet application.

## Verification

The Phase 21 script is a static source-contract check only. It does not execute PostgreSQL, prove migration compatibility, or establish runtime behavior. See release verification results supplied with the v0.198.0 archive.

The supported project runtime remains Node.js 24.15.0. This release has source-level verification only; runtime build, PostgreSQL execution and Testnet acceptance remain outstanding.

## Verification performed

- `npm run verify:static`: PASS, 57/57 consolidated gates.
- Phase 21 event-journal contract: PASS, 9/9.
- Phase 20 seller-net contract: PASS, 11/11.
- Database source contract: PASS, 131 executable GreenHaven tables across 163 migration files.
- Migration inventory check: PASS; 109 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 51 REVIEW_REQUIRED.
- Migration release-readiness source check: PASS.
- Dependency lock integrity: PASS.
- ZIP integrity: verified after packaging.

## Not performed / release blockers

No PostgreSQL server was available for executing the migration; no disposable database, Supabase Testnet, Pi/GHC provider, authenticated two-user browser E2E, Node.js 24.15.0 production build, live deployment or Git push was performed. The current runtime in the work environment is not the project's supported Node.js 24.15.0 runtime. Do not interpret static verification as migration acceptance or production readiness. Phase 20 commission policy and historical payout allocations still require reconciliation. Phase 21 is an audit trail only; audited refund/chargeback execution, dispute resolution, seller adjustment accounting and community renewal entitlement reconciliation remain future implementation work.
