# Phase 10 — Platform-wide acceptance

**Date:** 2026-11-08  
**Baseline:** 0.336.0  
**Release:** 0.337.0  

## Objective

Bind performance, accessibility, security, and regression source contracts into a single programme closeout gate — without claiming production approval.

## Source contracts in this increment

1. **Meta-gate** `scripts/check-phase10-platform-acceptance.mjs` verifies:
   - Programme phases 4–9 gates exist and are registered in `prebuild`
   - Node `^24.15.0` engines pin
   - Security headers, accessibility, resilience, and service-worker policy checkers exist
   - Reduced-motion and `:focus-visible` styles remain in global CSS
   - Project truth continues to state **Production NOT APPROVED**

2. **Programme completion register** — four allowed states only; no workstream marked Verified complete without live evidence.

## Explicitly still open (operator / device)

| Area | Evidence required |
|------|-------------------|
| Performance | Real-device Core Web Vitals / low-end Android / Pi Browser |
| Accessibility | Keyboard-only + screen-reader pass on primary flows |
| Security | Live RLS, durable session store, rate-limit exhaustion drills |
| Regression | Full Node 24.15.x typecheck/lint/build on CI + Testnet E2E |
| Financial | Pi Testnet settlement + 3π reconciliation (Phase 3 operator kit) |

## Production decision

**Production remains NOT APPROVED.** Source programme phases 4–10 are `Implemented, awaiting verification`.
