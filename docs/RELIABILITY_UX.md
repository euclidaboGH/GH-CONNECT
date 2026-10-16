# GH CONNECT — Reliability UX (Step 3)

Trust patterns for payments, device lock, and durable identity — without rewriting auth or the ledger.

## Principles (from banking / payments research)

1. **App lock ≠ logout** — Copy must say unlock *this device*; Pi identity stays authoritative.
2. **Calm payment failures** — Title + body + next step; one-tap retry; no blame language.
3. **Completion is memorable** — “You’re set” after profile checklist, tied to real progress.
4. **Durability honesty** — Soft banner only when identity/session durability checks fail.

## Implemented surfaces

| Surface | Behavior |
|---------|----------|
| Session lock | Title **Unlock this device**; PIN path does not clear onboarding |
| GH Pay panel | `classifyPaymentError` + **Retry payment** |
| Setup checklist | **You’re set** confirmation when all items complete |
| Home | `TrustDurabilityBanner` when `/api/health` durability checks fail |

## Payment error kinds

See `lib/pi-payment-errors.ts`: not_in_pi_browser, sdk_not_ready, approve_timeout, approve_config, network, auth, cancelled, unknown.

## Out of scope

- Changing Pi approve/complete algorithms  
- Replacing App Lock with WebAuthn  
- Auto-fixing missing Vercel env (Step 1 ops still required)  
