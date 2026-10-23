# GREENHAVEN — PHASE 39 DATABASE + BACKEND FINAL CONVERGENCE

## Objective

Unify the complete GreenHaven backend around one authoritative state model across the 131 ordered migrations and 114 executable GreenHaven tables.

## Final convergence rules

- Supabase is the production database authority.
- Server routes authenticate the actor; clients never supply authorization identity.
- GHC balances are authoritative in `ghc_transactions` and atomic economy RPCs.
- Pi payment completion is provider-verified and durable before entitlement/credit settlement.
- Membership tier is durable entitlement state, not client UI state.
- Social feed and comments use the canonical V3 RPC contracts; historical RPC fallbacks are retired.
- Curation uses the single atomic reward-aware RPC with server-derived reputation weight.
- Marketplace order state is durable and server-authoritative.
- Messaging, notification inbox, realtime recovery, media, communities, creator economy and activity correlation each have a single server boundary.
- Local caches/offline state remain presentation-only and cannot become production financial or identity authority.
- Schema drift is a deployment failure, not a reason to silently execute legacy business logic.

## Major fixes completed

1. Removed social RPC fallback chains that could silently execute historical contracts.
2. Removed feed V2/V1 RPC fallback and legacy per-table engagement hydration.
3. Removed comment V2/V1 and direct-table recovery fallback from the canonical comments path.
4. Removed curation vote-only fallback so a successful curation response cannot hide missing reward-aware atomic infrastructure.
5. Added `backend-contracts.ts` as the executable Phase 39 cross-module authority contract.
6. Expanded backend authority registry to communities, reputation, creator economy and activity correlation.
7. Exposed a non-secret backend contract version through `/api/system/status`.
8. Added `audit:phase39-backend-convergence` and wired it into `ci:verify`.
9. Added static migration/routine/table/API inventory checks and orphan-candidate reporting.

## Verification boundary

Static source verification is performed in this environment. A real Next production build, TypeScript compiler, ESLint run, browser E2E, live Supabase RPC execution, Vercel deployment, and Pi Testnet transaction are not claimed unless those dependencies/credentials are actually available.

## Release gate

Phase 39 is complete only when the convergence audit passes and the next phase validates the complete runtime contract under a real Node 24 dependency environment.
