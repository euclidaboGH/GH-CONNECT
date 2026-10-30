# GreenHaven v0.200.0 — Phase 23

## Scope
- Extend source-backed treasury reporting with marketplace gross, commission, seller net, gross/net adjustments, reserved allocations, paid settlements, and historical payout discrepancy counts.
- Preserve the prior treasury report as a base function and wrap it additively.
- Add append-only membership entitlement lifecycle events linked to canonical payment intent IDs.
- Add a read-only completed-membership-payment reconciliation RPC and expose it in the protected treasury summary and operator dashboard.
- Extend valid same-tier renewals from the current unexpired expiry timestamp instead of shortening/restarting the subscription window.
- Add a bounded service-role expiry sweep that updates expired paid entitlements to free and emits an immutable expiry event; it does not alter payment records.
- Keep PI and GHC as separate currencies; all financial values are sourced from durable records.

## Safety boundaries
- Migration `20261030010012_phase23_treasury_community_reconciliation.sql` is REVIEW_REQUIRED.
- No backfill or mutation of historical payouts, payment intents, or entitlement rows is performed.
- The membership reconciliation queue does not grant access. Payment verification and entitlement grant paths remain responsible for fulfillment.
- Expiry is reported as a time-derived state; no scheduled expiry worker or external renewal charge is claimed.
- Historical allocations without proceeds snapshots are flagged, not converted to seller net.

## Verification limitations
- All source-level checks in this increment are repository-only checks; they do not establish runtime database behavior.
- This environment has no `psql`, `postgres`, or Docker executable; no disposable PostgreSQL validation or concurrent transaction test could be run.
- Social and messaging work in this increment is an audit/verification pass over existing contracts, not a claim of full redesign. Existing mobile/accessibility contracts remain part of the broader audit; a device/browser acceptance pass is still required.
- Supported Node.js 24.15.0 production build and authenticated PI/GHC Testnet flows remain required.
