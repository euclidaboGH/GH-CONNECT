# Priority 4 — Membership product transformation (0.330.26)

Date: 2026-11-07

## Audit baseline

The 0.330.25 source already contained a substantial membership foundation: server-authoritative status, prepaid VIP/VVIP catalog, separate GHC and Pi prices, authenticated lifecycle history, Pi intent ownership/product/amount verification, atomic GHC purchase, recoverable post-payment activation, server-side entitlement checks, operator renewal/expiry workflows and explicit no-auto-renew policy. This increment does not recreate those systems or change their authority.

The audit found several product-experience defects in the existing membership surface:

- The comparison table used a separate hardcoded matrix instead of deriving benefits and selected-term prices from the canonical membership catalog.
- The current-membership card advertised **Renew** but navigated to the current plan card, which intentionally had no purchase action while that same tier remained active. The activation API also deliberately returns `alreadyActive` for an active same-tier entitlement rather than charging again.
- The purchase confirmation described the purchase as a subscription and said GHC would be spent even when the user selected Pi. The confirmation did not present both catalog prices clearly before the payment choice.
- A contradictory “No paid boosts or priority placement” line appeared on paid plans even though their canonical plan data grants daily boosts and discovery priority.
- Every Free account was shown a purchase-recovery prompt, even without an interrupted/ambiguous purchase.
- The active membership benefit summary duplicated hardcoded plan claims rather than reflecting the canonical plan data.
- Membership activity exposed only five of the bounded history entries, with no way to expand the view.
- The refresh completion message could use stale React state rather than the actual result of the refresh request.

## Implemented product transformation

### Plan discovery and comparison

- Replaced the hardcoded comparison matrix with a comparison model generated from `MEMBERSHIP_PLANS` and the shared `getMembershipGhcPrice` / `getMembershipPiPrice` pricing functions.
- Comparison prices now follow the selected prepaid duration and display GHC and Pi as distinct catalog prices, not a conversion.
- Comparison now includes plan-controlled photo/story limits, daily boosts, capped activity earning multipliers, fee discounts and selected entitlements across discovery, matching, community, marketplace, creator/business, analytics and support.
- Current membership benefit summaries now read plan limits and entitlements from the canonical membership domain; the account view also surfaces the server-confirmed membership start date.
- The side-by-side comparison has a descriptive accessible caption.
- Removed the false “No paid boosts or priority placement” claim from paid plan cards.

### Membership management and renewal clarity

- Replaced the broken active-plan “Renew” action with meaningful navigation: Free members can explore VIP; VIP members can inspect VVIP; VVIP members open the side-by-side comparison.
- Kept active same-tier purchase blocked as before. The source does not introduce a premature renewal, a recurring subscription, or an unsupported same-tier extension. After expiry, the existing server-authoritative purchase path remains available.
- Clarified that VIP/VVIP are one-time prepaid terms with one bonus month and no automatic renewal.
- Distinguished complimentary paid access without an expiry from Free access.
- Expanded the bounded account lifecycle history from five visible events to an optional full view of up to the existing 20 returned events; the stream remains read-only, authenticated, cancellable and account-scoped.

### Purchase decision and trust

- Purchase review now shows the exact GHC and Pi catalog amounts for the selected tier and duration before the user chooses one payment rail.
- Payment buttons repeat the exact selected amount; copy explicitly says the two prices are separate and not a currency conversion.
- Removed the inaccurate claim that all purchase confirmations spend GHC. No price, server catalog, payment rail, entitlement grant, ledger, refund, settlement or provider behavior changed.
- Purchase recovery is offered only after an interrupted or ambiguous purchase path, not to every Free account.
- Refresh feedback now reflects the actual request result.

## Security and authority preserved

- Membership status remains server-authoritative and fail-closed when unavailable.
- GHC and Pi remain separate payment rails and catalog prices.
- Pi activation still requires the authenticated user's durable COMPLETED/FULFILLED intent, exact product ID and exact amount.
- GHC purchase remains server-side atomic spend-plus-entitlement.
- Protected product APIs continue to enforce membership from authoritative server entitlement, not browser cache.
- No client-side payment completion, balance mutation, entitlement grant, refund, renewal, expiry or recurring billing authority was introduced.
- No migration was added or applied.

## Verification

- `scripts/check-priority4-membership-transformation.mjs`: 20/20.
- Full consolidated `npm run verify:static`: 57/57 passed.
- Existing Phase 9 membership release gate: 16/16.
- Pi intent security: 19/19.
- Membership consumer audit: 8/8.
- Membership experience contract: 23/23.
- Strict Pi intent contract: 12/12.
- Renewal policy: 15/15.
- Session safety: 15/15.
- Membership foundation: 20/20.
- Membership row parser: 14/14.

These are source/static and pure-policy checks. Node 24.15.x dependency-backed typecheck, lint and production build, real browser/Android/Pi Browser acceptance, database concurrency and Testnet payment/renewal/expiry acceptance remain outstanding. Membership migrations previously classified `REVIEW_REQUIRED` remain unapplied until remote Testnet/Mainnet histories and disposable PostgreSQL validation are reconciled.

## Release boundary

Priority 4 source transformation is active and materially upgraded in 0.330.26. This is not production approval. Priority 5 Profile remains untouched.
