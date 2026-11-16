# GreenHaven — Current Project Bundle

**Package:** `gh-connect@0.338.86`  
**Hardening program:** Phases 1–4 complete in source  
**Date:** 2026-11-16  

## Delivery identity
Record SHA-256 of each packaged zip after build.

| Artifact | SHA-256 |
|----------|---------|
| HARDENING phases 1–4 complete | *(see package output)* |

## Hardening summary
1. **Phase 1** — Address privacy hard-delete + CI proposal scan + route hardening  
2. **Phase 2** — Operator keys, JWT claims, cookie CSRF, CSP, approve hardening, rate limits  
3. **Phase 3** — Money/auth contracts, Playwright CI, supply chain, lint ratchet → 100, critical audit  
4. **Phase 4** — Central Supabase client (0 raw `/rest/v1/` under `lib/`), file splits, image opt flag, worklog archive  

## Gates
- Node 24.15+  
- No bulk migration push while REVIEW_REQUIRED remains  
- **Production remains NOT APPROVED**

## Key docs
- `docs/SOURCE_OF_TRUTH.md`
- `docs/HARDENING-PROGRAM-4-PHASES.md`
- `docs/HARDENING-PHASE4-STRUCTURE-RELEASE-PROGRESS.md`
