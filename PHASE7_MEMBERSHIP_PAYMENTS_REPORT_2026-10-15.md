# GreenHaven Phase 7 — Membership & Payments
Date: 2026-10-15

## Scope
Production hardening of Pi/GHC membership activation, recovery, entitlement authority, duplicate-charge prevention, and status presentation. No reward rates, wallet balances, marketplace, escrow, or withdrawal economics were changed.

## Fixes implemented

1. **Payment recovery now repairs membership entitlement.**
   - `/api/payments/intents/[intentId]/recover` previously recovered a Pi payment to `COMPLETED` but did not grant the associated membership entitlement.
   - Recovery now calls the same server-authoritative, idempotent membership grant used by payment complete/fulfill.
   - Already `COMPLETED`/`FULFILLED` recovered intents also re-attempt the entitlement grant, allowing durable recovery after a prior entitlement-store outage.

2. **Membership UI is fail-closed to server authority.**
   - VIP/VVIP is displayed only when `/api/membership/status` confirms the durable entitlement.
   - Stale local membership cache can no longer make the screen present a paid tier when the authoritative store is unavailable.
   - Loading and unavailable states are explicit instead of silently appearing as Free.

3. **Duplicate-charge guard.**
   - Pi and GHC membership purchase actions are blocked until authoritative membership status has loaded successfully.
   - If status is unavailable, the screen refreshes status rather than allowing a purchase that could duplicate an existing active membership.

4. **Authoritative expiry display.**
   - Membership expiry shown in the header now comes from the server-confirmed entitlement rather than local cached membership state.

## Existing protections preserved
- Pi complete remains authenticated and bound to a durable owned intent.
- Amount, currency, product ID, tier, and billing period validation remain server-side.
- Entitlement grants remain idempotent by purchase reference.
- `/api/payments/complete` grants membership without depending on a later client activation call.
- `/api/payments/fulfill` remains a second idempotent entitlement repair path.
- `/api/membership/status` returns 503 when durable authority is unavailable rather than falsely reporting Free.
- GHC spend remains server-side and idempotent; a failed entitlement write can be retried without intentionally charging the same reference twice.

## Verification
- `node scripts/check-jsx-safety.mjs`: PASS — 613 files scanned.
- Full `next build` was not run because the extracted project does not include installed dependencies/node_modules. No lint/type/build bypass was added.

## Runtime verification still required
Real Pi Browser + configured Pi API + Supabase should verify: VIP monthly/yearly, VVIP monthly/yearly, interrupted payment recovery, repeated complete/fulfill/recover calls, entitlement-store temporary outage/recovery, expiry, and GHC idempotent retry.
