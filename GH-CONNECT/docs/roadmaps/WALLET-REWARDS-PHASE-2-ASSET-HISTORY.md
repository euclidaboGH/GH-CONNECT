# Wallet & Rewards Phase 2 — Asset Activity and Transaction History

## Scope

This additive pass improves the existing GHC transaction-history controls without introducing a new ledger, payment rail, schema, or client-side financial authority.

- Search can match transaction IDs and correlation/reference IDs as well as descriptive fields.
- Date filters use explicit labels and expose selected state to assistive technology.
- Transaction type filters expose selected state and visible keyboard focus.
- The result count is announced politely and a single clear action resets the search and all filters.
- Pi payment intents remain in their separate history rail; GHC ledger transactions and Pi provider records are not merged.

## Security and data boundaries

Search is presentation-only and only inspects records already loaded for the authenticated user. It does not fetch other users' records, alter ledger entries, trigger payments, or retry transactions. Amounts, transaction status, identity, and settlement remain authoritative only at the existing server/provider boundaries.

## Validation

Run `npm run check:wallet-phase2-asset-history` and the full existing static verification pipeline. This targeted check is not a substitute for typecheck, lint, production build, browser tests, Supabase/RLS checks, or Pi Testnet end-to-end verification.

Document date: 2026-11-03.
