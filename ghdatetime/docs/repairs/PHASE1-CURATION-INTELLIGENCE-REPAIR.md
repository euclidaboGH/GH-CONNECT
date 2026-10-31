# Phase 1 — Curation Intelligence Reliability

## Scope

This phase improves server-side observability for the existing curation intelligence pipeline and adds a read-only Testnet diagnostic script. It does not bypass the durable-intelligence requirement, introduce client-side voting authority, mint GHC, or alter the canonical atomic vote/reward RPC.

## Source-level change

`app/api/social/posts/[id]/curation/route.ts` now records a sanitized diagnostic when `gh_reputation_intelligence_refresh` fails instead of silently discarding the refresh result. A failed refresh does not automatically reject a vote if a previously persisted snapshot is still valid; the existing authoritative snapshot resolver remains fail-closed when no usable snapshot is available. Database details are logged server-side only.

## Testnet operator verification

1. Open the Supabase project used by the `testnet` Vercel deployment.
2. Run `docs/repairs/PHASE1-CURATION-INTELLIGENCE-DIAGNOSTICS.sql` in SQL Editor. It is read-only.
3. Confirm the required source tables/columns and RPC signatures are present, RLS is enabled on the intelligence tables, and snapshots exist.
4. Attempt one testnet curation action and inspect Vercel function logs for one of: `CURATION_DATABASE_CONFIGURATION`, `CURATION_MIGRATION_NOT_READY`, `CURATION_INTELLIGENCE_REFRESH_FAILED`, or `CURATION_SNAPSHOT_MISSING_OR_UNREADABLE`.
5. If the SQL query errors on a dependency column/table, capture the exact failing statement and reconcile the schema before applying any further migration. Do not blindly rerun migrations.

## Important limit

Source checks cannot prove the live Supabase schema, service-role environment, or Vercel deployment is correct. This phase is source-verified; live Testnet verification remains required.
