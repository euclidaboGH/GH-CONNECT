# Phase 9 — Membership session integrity (0.325.0)

## Scope

This increment hardens the client presentation boundary around the existing server-authoritative membership status endpoint. It does not add a payment rail, change catalog prices, grant entitlements, renew subscriptions, or alter database authority.

## Changes

- Membership status reads use an `AbortController`, an eight-second timeout and a monotonically increasing request sequence. Older responses cannot overwrite a newer account/session result.
- Outstanding reads are aborted on component unmount and on wallet-auth changes.
- A wallet-auth change immediately clears the prior account's paid membership display, success state and purchase-recovery hint. A newly active wallet session triggers a fresh no-store server read.
- Session resume and visible-tab restoration revalidate membership against the server.
- Client hydration rejects missing identity, unknown tiers, non-boolean activation flags, inactive paid entitlements and paid entitlements without a finite future expiry. No generic `current-user` identity fallback remains.
- Failed, malformed and timed-out status reads clear stale paid presentation and report unavailable rather than silently retaining old account state.

## Financial and security boundaries

- The authenticated server endpoint remains the only authority for VIP/VVIP status.
- GHC and Pi remain separate payment rails and assets.
- Purchase catalog, amount calculation, payment intent ownership, completion/fulfilment and entitlement writes remain server-authoritative.
- No client-side payment completion, renewal, entitlement grant, ledger credit or settlement authority was added.
- No SQL migration was added or applied.

## Verification

`node scripts/check-phase9-membership-session-safety.mjs` covers request cancellation, sequence fencing, identity-change clearing, session-resume refresh, strict response validation, release metadata and roadmap alignment.

Full TypeScript, lint, Next.js build, database integration, browser/device and live payment acceptance remain separate release gates and must be run with the repository's required Node 24.15.x environment and installed dependencies.
