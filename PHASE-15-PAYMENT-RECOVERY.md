# Phase 15 — Payment recovery guidance and support workflows (v0.104.0)

## Objective
Make uncertain, delayed, and incomplete Pi payment states easier to understand and safer to recover from without adding a client-side payment authority or blindly retrying charges.

## Delivered
- Added a read-only refresh action to the Pi payment history header. It reloads the existing authenticated intent and reconciliation data through the current fetch lifecycle; it does not submit, approve, cancel, or retry a payment.
- Added status-specific recovery guidance to Pi transaction details for paid-but-not-fulfilled, fulfilled, failed/cancelled/incomplete, and in-progress states.
- Added a downloadable support summary containing the persisted intent identifiers, status, amount when available, and the current reconciliation finding/code. The UI warns that the file contains payment identifiers and should be reviewed before sharing.
- Preserved the existing receipt export and explicitly distinguished payment-intent records from provider settlement or feature fulfilment proof.
- Kept the GHC ledger and Pi payment history separate; no new writes, migrations, balance changes, or provider calls were introduced.
- Updated release metadata to `0.104.0` and added static contract checks.

## Safety rules
- Do not automatically create a new payment when an existing result is ambiguous.
- A `COMPLETED` intent is not treated as proof of delivery or entitlement activation.
- Unknown feature mappings remain unverified.
- Support summaries are user-triggered downloads and are not uploaded to any server.

## Verification limits
Static checks are network/DB independent. Full TypeScript/build/browser testing and live Pi Testnet/Supabase verification require the project's declared Node.js `24.15.0` runtime and a configured test environment. No claim of live payment verification is made by this phase.
