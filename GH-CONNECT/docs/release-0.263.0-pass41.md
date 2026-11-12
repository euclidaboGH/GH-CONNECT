> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.263.0 — Pass 41: Marketplace & Feed Request Resilience

## Scope

This release hardens the marketplace's three independently hydrated views: saved listings, seller listings, and durable orders. Each loader now uses a monotonically increasing request sequence so a slower response from an earlier navigation cannot overwrite a newer result. Only a successful, well-formed response replaces displayed data; an authoritative empty array is still allowed to clear the view, while network errors, rejected requests, and malformed payloads preserve the last known records. Loading indicators are finalized only by the active request, and pending request sequences are invalidated when the screen unmounts.

Feed refreshes now use a consistent latest-request-wins policy. A newer refresh or page request aborts superseded work, preventing out-of-order page commits and unnecessary network use. The GHC context aborts outstanding feed work and invalidates its generation during unmount.

## Preserved boundaries

- No Supabase migration SQL changed.
- No payment, wallet, ledger, membership entitlement, reward execution, checkout authorization, or order-transition logic changed.
- Server responses remain authoritative; local request sequencing is only client-side presentation protection.
- Canonical navigation remains Home · Messages · Communities · Cart · Profile; Wallet remains an overlay.

## Verification limits

The Pass 41 gate validates source contracts. It does not replace a supported-runtime TypeScript/production build or live Testnet verification. Node 24.15.x and the locked dependencies are required for full build verification. Deployed Supabase RLS, Pi payment recovery, and financial reconciliation still require operational evidence.
