# GreenHaven Phase 5 — Release readiness & production scale (source)

**Baseline:** `GREENHAVEN-0.312.0-PHASE-4-PRODUCT-EXPERIENCE-2026-11-04.zip`  
**Package version:** 0.312.0  
**Date:** 4 November 2026  

## Purpose

Close the five-phase programme with an operator-facing release gate. This phase does **not** claim:

- Mainnet readiness  
- Applied Supabase migrations  
- Funded A2U success on Testnet  

It **does** define source contracts, fail-closed defaults, health surfaces, and the sequence operators must run before any Testnet promotion.

## Programme map (Phases 1–5)

| Phase | Focus | Package signal |
|-------|--------|----------------|
| 1 | Critical integrity (curation messaging, cart idempotency, static contracts) | Phase 1 critical integrity |
| 2 | Architecture & identity convergence | Phase 2 complete |
| 3 | Finance & commerce honesty | Phase 3 finance/commerce |
| 4 | Product experience (communities, discover, messaging, feed, notifications) | Phase 4 product experience |
| 5 | Release readiness, ops checklist, aggregated gates | **This document** |

## Fail-closed defaults (must stay off until explicitly enabled)

From `.env.example` (names may grow; treat missing as disabled):

- `PI_A2U_ENABLED=0`
- `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=0`
- `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=0`
- `GHC_WITHDRAWALS_ENABLED=0`
- `GHC_REGISTRATION_BONUS_ENABLED=0`
- `GHC_REFERRAL_SETTLEMENT_ENABLED=0`
- `GHC_CURATION_REDISTRIBUTE_ENABLED=0`
- `GHC_ACTIVITY_REWARDS_ENABLED=0`
- `GHC_BUY_WITH_PI_ENABLED=0`
- `GHC_MARKETPLACE_GHC_PAYOUTS_ENABLED=0`
- `GHC_TIPS_ENABLED=0`

Never enable Mainnet Pi flags on a Testnet deployment.

## Infrastructure health (read-only)

| Endpoint | Scope |
|----------|--------|
| `GET /api/health/withdrawals` | Withdrawal **infrastructure** only — not user eligibility |
| `GET /api/economy/health` | Economy subsystem (when deployed) |
| `GET /api/payments/health` | Payment provider probes (when deployed) |

Authenticated eligibility remains on `GET /api/economy/earnings/withdrawable`.

## Operator Testnet sequence (condensed)

1. Review migrations (`supabase migration list --remote`) — do not `db push` unreviewed SQL.  
2. Confirm notification `createdAt` ORDER BY migrations applied if still pending.  
3. Deploy Preview from reviewed `main`.  
4. Hit `/api/health/withdrawals` — expect structured JSON, no secrets.  
5. Two-account smoke: identity link → wallet authorization → withdraw **request** only if flags allow.  
6. Marketplace: own-listing blocked; multi-line cart; Orders recovery after partial fail.  
7. Communities: create/join appears under **My**.  
8. Discover: follow optimistic + failure rollback.  
9. Messaging: DM shows peer name when in following/friends.  
10. Record evidence; do not mark PRODUCTION VERIFIED from source checks alone.

## Source verification commands

```bash
node scripts/check-phase2-architecture-identity-2026-11-04.mjs
node scripts/check-phase3-finance-commerce-2026-11-04.mjs
node scripts/check-phase4-product-experience-2026-11-04.mjs
node scripts/check-phase5-release-readiness-2026-11-04.mjs
npm run check:release-hygiene
npm run check:project-truth
```

Full static suite remains `npm run verify:static` when Node 24.15.0 and lockfile are available.

## Accessibility / UX notes shipped in Phase 5

- Cart checkout CTA exposes `aria-busy` / `aria-disabled` while reserving/paying.  
- Checkout progress uses `role="status"` + `aria-live="polite"` (Phase 3).  

## Explicit non-goals

- Changing financial ledger schema  
- Auto-enabling A2U  
- Declaring CI green without running CI on GitHub  

## Decision language

Use independent labels:

- SOURCE VERIFIED  
- DATABASE APPLIED  
- RUNTIME VERIFIED  
- TESTNET VERIFIED  
- PRODUCTION VERIFIED  

Do not collapse them into a single PASS.
