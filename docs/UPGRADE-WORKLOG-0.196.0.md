# GreenHaven upgrade worklog — 0.196.0

Date: 2026-10-30

## Phase 19 — marketplace durable RPC transport hardening

- Added a 10-second timeout to durable marketplace order-store PostgREST RPC calls.
- Added explicit `cache: no-store` and `Cache-Control: no-store` to those requests.
- Preserved legitimate empty-body PostgREST void RPC handling.
- Changed non-empty malformed RPC response handling from optimistic success to fail-closed `null`.
- Added the same bounded timeout and no-store request behavior to the marketplace GHC spend RPC.
- Preserved payment-claim retention when GHC spend outcome is ambiguous; only definite insufficient balance releases the claim.
- Added 12 Phase 19 source-contract checks to prebuild, static verification and GitHub Actions.

## Validation boundary

This increment has source-contract validation only. It has not been run against disposable PostgreSQL, authenticated Pi Testnet, a live Supabase project, or a production Next.js runtime. Node 24 installation, typecheck, lint and build remain release gates. No migration was added or applied.

Runtime boundary: this environment did not execute the Node.js 24.15.0 dependency install, TypeScript, lint or Next.js production build. The worklog documents source-level checks only; do not treat this as deployment approval.
