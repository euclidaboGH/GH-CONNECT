# Upgrade worklog — 0.330.27

## Baseline

Started from the complete `GREENHAVEN-0.330.26-PRIORITY-4-MEMBERSHIP-TRANSFORMATION.zip` source tree. This is a continuation of product Priority 4 Membership, not historical engineering Phase 4.

## Files changed

- `components/ghc/premium-membership-screen.tsx` — comparison category filtering, fail-closed purchase CTA, VVIP downgrade UX guard, remaining-term details, full price/savings disclosure, accurate payment-source attribution.
- `lib/domains/membership-domain.ts` — explicit Pi payment source type.
- `app/api/membership/activate/route.ts` — server-side active VVIP downgrade rejection before GHC debit/activation.
- `app/api/payments/intents/route.ts` — rejects non-canonical membership products and active VVIP-to-VIP downgrades before creating a Pi provider intent.
- `lib/server/membership/entitlement-store.ts` — verified Pi completion downgrade rejection.
- `supabase/migrations/20261107160001_membership_active_tier_downgrade_guard.sql` — additive row-level downgrade guard; review-required and unapplied.
- `scripts/check-priority4-membership-transformation.mjs` — expanded source contract.
- Migration inventory/checklist and canonical release documentation refreshed.

## Version

`0.330.27`

## Operational boundary

No database migration was applied, no remote history was changed, and no payment/ledger/entitlement transaction was executed. Full runtime and external acceptance remain open.
