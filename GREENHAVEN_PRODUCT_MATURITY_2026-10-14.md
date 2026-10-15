# GreenHaven Product Maturity Pass

Date: 2026-10-14

## Objective
Move the existing GreenHaven product away from a demo/card-dashboard presentation and toward a calmer, content-first, production application without changing domain logic, Pi payment flows, authentication, Supabase contracts, server authority, or security behavior.

## Applied
- Reworked the global visual hierarchy through shared product tokens instead of screen-by-screen decorative overrides.
- Expanded the focused content canvas responsively on tablet/desktop while keeping phone layouts native and edge-efficient.
- Reduced excessive rounding and elevation and softened borders across shared card surfaces.
- Reframed global background and app chrome so content carries more visual weight than controls.
- Refined bottom navigation and the create action to feel like stable application chrome rather than a floating demo dock.
- Simplified feed presentation by removing the Home Command Centre and trust/status promo block from the public timeline. Their underlying features/components were not deleted.
- Preserved feed filters, stories, posting, search, notifications, ranking, comments, reactions, discovery, messaging, profile, marketplace, wallet, membership and all backend contracts.

## Explicitly unchanged
- Pi SDK/payment behavior
- Membership entitlement logic
- Wallet/economy authority
- Supabase schemas/RLS/migrations
- Authentication/session behavior
- Marketplace order contracts
- Social authorization rules
- API routes

## Verification
Run the existing static/release suites plus full dependency-backed typecheck/lint/build before deployment.
