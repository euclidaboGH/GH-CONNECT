# Phase 1–14 — Resilience / Retry / Offline Source Baseline

**Status:** PASS WITH FIXES (source)  
**Phase 15:** NOT STARTED  
**Migrations:** 54 unchanged

## Defects fixed this pass

1. **Intent recover / cancel / GET were memory-only**  
   - Routes under `app/api/payments/intents/[intentId]/` used `getPaymentIntent` only.  
   - After Vercel cold start, recovery/cancel/status could 404 despite durable rows.  
   - **Fix:** durable-first `loadPaymentIntent` then memory fallback.

2. **Incomplete payment recovery fetch lacked explicit `credentials: "include"`**  
   - `lib/pi-incomplete-payment.ts` relied on default same-origin cookies only.  
   - **Fix:** explicit `credentials: "include"` aligned with GH Pay / media clients.

## Verified (no code change)

| Area | Behavior |
|------|----------|
| Daily claim | Server idempotency key + RPC; client amount ignored; claim UI busy guard |
| Pi complete / incomplete | Auth + ownership; idempotent COMPLETED/FULFILLED |
| Membership post-pay | Poll `/api/membership/status`; busy guard; no local VIP invent |
| Wallet offline | Banner + last known ledger; P2P blocked offline |
| Service worker | `/api/**` network-only; API offline → JSON NETWORK_UNAVAILABLE |
| Media upload | Fail codes 400/501/502/503; no false success URL |
| Social likes | Feed `pendingLikesRef` + rollback; share awaits durable API |
| Claim double-submit | Rate limit + atomic RPC idempotent |
| Offline queue | Not used for financial mutations |

## Residual (non-blocking / operator)

- Feed pull-to-refresh still simulates delay (does not re-fetch durable feed).
- Context `reactToPost` optimistic path does not always roll back on network failure (feed handler does).
- Process-local rate limits only.
- typecheck / lint / build / Testnet / Pi E2E / live IDOR: **NOT RUN**
