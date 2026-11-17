# Marketplace transformation — Phase 1: Trust & speed (source candidate)

Base: `0.338.86` (Run #302). Scope: source-only, additive, no migration, no financial or provider change.
Research input: screen recording of the live Piket marketplace on Pi Browser (listing grid, product detail, account hub, wallet sign-in, mining).

## Delivered
1. `lib/marketplace/review-quality.ts` — ratings summary counts only order-linked, validly rated reviews; featured reviews exclude too-short, letterless, repeated-character and same-reviewer duplicate text. Display layer only; stored reviews and the completed-order gate in the domain are untouched.
2. `lib/marketplace/landed-cost.ts` — item + delivery presentation. Never sums mixed currencies; unknown delivery reads "confirmed at checkout". The server quote remains payment authority.
3. `lib/marketplace/listing-badges.ts` — stock, delivery and seller-trust badges derived only from recorded data.
4. `lib/marketplace/seller-checklist.ts` — pure first-run listing checklist (helper ready; UI wiring is Phase 2 Seller Centre).
5. `components/ghc/marketplace-skeleton.tsx` — stable-height skeleton grid, reduced-motion aware, shown only on initial browse load with no listings.
6. Screen wiring in `components/ghc/marketplace-screen.tsx`: "In stock" badge, seller badges, verified-purchase rating line with featured reviews, item/delivery line above the Buy button.

## Verification
- `scripts/check-phase1-marketplace-trust-speed.mjs`: 19/19.
- `scripts/test-phase1-marketplace-trust-speed.mjs`: passes (reviews, landed cost, badges, checklist).
- 15 existing marketplace/UI gates re-run and pass.
- `check-jsx-duplicate-props` could not run here (needs the `typescript` package; dependencies not installed).

## Not claimed
Node 24.15.0 typecheck/lint/build, browser/device acceptance, live data. Production remains NOT APPROVED. No version bump, push or deployment.
