> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.264.0 — Pass 42: Marketplace Domain Boundary

## Scope

This pass addresses a cross-cutting architecture weakness rather than adding another isolated screen feature: marketplace UI code previously normalized saved-listing, seller/public listing, and durable-order API records inline. The same domain data was therefore interpreted in multiple places, increasing drift risk and making the UI responsible for backend response compatibility.

## Changes

- Added `lib/marketplace/record-mappers.ts` as the shared API-to-domain boundary for listing, saved-listing, and durable-order records.
- Reused the listing mapper for saved, seller-owned, and public listing hydration.
- Reused the durable-order mapper for order hydration while retaining server-supplied lifecycle, payment, delivery, and order identifiers.
- Preserved valid numeric zero values (for example, zero price or availability) rather than treating them as missing data.
- Normalized both numeric epoch and ISO-8601 timestamps, including saved-listing `updated_at` values, without replacing update time with creation time.
- Rejected records without stable identifiers at the mapping boundary.
- Added runtime regression tests for API field aliases, nested saved metadata, explicit zero values, numeric and ISO lifecycle timestamps, saved-listing update-time preservation, payment/delivery fields, and invalid records.
- Added the Pass 42 static release gate and wired both checks into the production prebuild sequence.

## Safety boundaries

- No SQL migration was changed.
- No wallet, payment, checkout, order mutation, or financial authorization behavior was changed.
- No client-side price or payment authority was introduced.
- Existing Pass 41 stale-response guards and last-known-data preservation remain in place.
- Canonical navigation remains Home · Messages · Communities · Cart · Profile; Wallet remains an overlay.

## Verification

Run `npm run check:pass42`. Full production build and typecheck remain subject to the repository's required Node.js runtime (`^24.15.0`).
