# GreenHaven upgrade worklog — 0.308.0

## Phase 22 — marketplace transaction integrity

Inspected marketplace order creation, payment, commerce transition, durable storage and migration contracts. Found that the shared durable `transitionOrder` implementation still loaded an order and later persisted a full upsert, leaving a read/modify/write race between concurrent order-state requests.

Replaced the database-configured transition path with a dedicated row-locking RPC. The SQL function validates transitions against the existing state graph under `FOR UPDATE`, appends the audit record, and returns the refreshed canonical order. Both generic and commerce cancellation paths reject active payment claims; payment verification and confirmation require persisted verified payment status. The application fails closed on RPC errors and does not fall back to process memory. The canonical order read now includes commerce/delivery fields already present in the schema. Payment/ledger/escrow/refund/payout authority remains unchanged.

Added one `REVIEW_REQUIRED` migration, updated the canonical migration source manifest/checklist, release metadata, project truth and source-of-truth documentation, and registered a Phase 22 source gate in both `prebuild` and `verify:static`.

## Verification

This is source-only evidence. The Phase 22 source gate, Phase 20 payout durable-control gate, Phase 21 private-surface gate, migration source-manifest gate, project truth, documentation hygiene, and consolidated static suite are run for this source increment. The environment is Node 22.16.0 while the project pins Node 24.15.0; `node_modules` is absent. Therefore supported-runtime typecheck, lint and production build are not claimed. The migration has not been applied; live PostgreSQL concurrency, Supabase, Pi provider, Vercel, browser/device and operator acceptance remain outstanding. Production remains **NOT APPROVED**.
