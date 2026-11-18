# GreenHaven Phase 2 — COMPLETE: Architecture & Identity Convergence

**Baseline:** `GREENHAVEN-0.312.0-PHASE-1-CRITICAL-INTEGRITY-2026-11-04.zip`  
**Completed:** 4 November 2026  
**Version lineage:** 0.312.0 Phase 2 complete  

## Objectives (done)

1. Coherent identity comparison across Pi UID and canonical app user id  
2. Marketplace ownership that survives id-form mismatch  
3. Shared authenticated client request helper  
4. Graph membership helpers that respect session aliases for self  
5. Earnings + rewards claim paths on the shared request convention  
6. Preserve server authority for money, payouts, and RLS  

## Delivered inventory

| Module / surface | Role |
|------------------|------|
| `lib/identity/identity-match.ts` | `isSameIdentity`, `isOwnedByCurrentUser`, `getSessionIdentityAliases`, `idListIncludes` |
| `lib/identity/identity-service.ts` | `matchesUserId`, `getIdentityAliases` |
| `contexts/identity-context.tsx` | Exposes match helpers |
| `lib/client/api-request.ts` | Auth headers, timeout, safe errors |
| `lib/social-graph.ts` | following/friend/block/match via `idListIncludes` |
| `lib/domains/profile-domain.ts` | Self + following via identity match |
| `lib/domains/social-graph-domain.ts` | `isMutual` delegates to helpers |
| `components/ghc/marketplace-screen.tsx` | Own listing filter + block add-to-cart |
| `components/ghc/discovery-grid-screen.tsx` | Hide self via aliases |
| `components/ghc/unified-earnings-dashboard.tsx` | Refresh via `apiRequest` |
| `components/ghc/rewards-centre-screen.tsx` | Claim via `apiRequest` |
| `scripts/check-phase2-architecture-identity-2026-11-04.mjs` | Source contract |

## Explicitly deferred (Phase 3+)

- Full mechanical decomposition of `contexts/ghc-context.tsx` (~8.5k lines) — domain providers remain the extension path  
- Next.js 15.5.29 dependency bump (operator lockfile)  
- Live Testnet / Supabase identity-row proof  
- Atomic multi-item Pi cart settlement redesign (Phase 3 commerce)  

## Verification

```bash
node scripts/check-phase2-architecture-identity-2026-11-04.mjs
```

Expect: all PASS.

## Handoff to Phase 3

Phase 3 focuses on **financial and commerce transformation**: wallet rails, Pi A2U, GHC ledger honesty, rewards settlement, marketplace atomic checkout, withdrawal recovery — building on identity and request conventions established here.
