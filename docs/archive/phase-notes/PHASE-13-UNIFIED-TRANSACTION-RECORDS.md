# Phase 13 — Unified transaction record exports

Release: `0.102.0`

## Implemented

- Extends the existing GHC ledger transaction detail with copy, native share, and plain-text download actions, matching the portability already available for Pi payment-intent records.
- Export includes only curated persisted transaction fields: reason/type, signed amount, status, created/posted timestamps when present, transaction ID, reference ID, and source event. It does not export arbitrary metadata or user identifiers.
- Exported text clearly states that it is a GHC ledger record, not external bank/Pi settlement proof.
- Adds user-facing feedback for copy/share/download outcomes and Escape-key dialog dismissal.
- Preserves the authoritative GHC ledger and Pi payment intents as separate asset rails. No balances, payment states, fulfilment states, or entitlements are changed.

## Verification boundaries

The new checks are source-level and network-independent. Full TypeScript checking, lint, production build, browser accessibility checks, and live Supabase/Pi Testnet verification must still be run in the supported Node.js `24.15.0` runtime before deployment.
