# GreenHaven v0.157.8 — Phase 9 wallet transaction integration hardening

## Baseline

Built from `GREENHAVEN-0.157.7-PHASE8-WALLET-FINANCIAL-RELIABILITY-2026-10-28.zip`. No live Supabase, Pi Network, Vercel, or production environment was accessed or modified.

## Audit findings and changes

- The Pi transaction projection previously allowed a missing amount to remain in a row and accepted zero amounts. It now requires a positive, finite amount with at most eight decimal places.
- Numeric string parsing now uses a decimal-only grammar, preventing JavaScript coercion of booleans and non-decimal strings into financial values.
- Intent IDs, provider payment IDs, references, status/purpose labels, and product labels are bounded and reject control characters.
- Implausibly future transaction timestamps are treated as unknown, not as verified history. Missing timestamps are never replaced with the current time.
- Payment-intent creation rejects boolean/null/blank/malformed amount values, excessive precision, invalid metadata types, and control characters in reference and idempotency identifiers.
- The Phase 9 source-contract suite was expanded for these validation boundaries. Package, lockfile, release metadata, manifest, README, project truth, and consolidation report are synchronized to v0.157.8.

## Financial invariants preserved

- Pi transaction history remains restricted to authenticated user-scoped `provider === "pi"` and `currency === "PI"` records.
- Reconciliation remains read-only, bounded in concurrency, and does not mutate orders, payments, memberships, balances, or fulfilment.
- GHC ledger records remain separate from Pi payment intents. Unsupported mappings remain unverified.
- No migration, provider call, live database write, or production setting was changed.

## Verification boundaries

Source checks do not establish live financial correctness. Supported Node.js 24.15.0 dependency installation, TypeScript, lint, production build, browser/device journeys, actual Supabase schema/RLS verification, Pi Testnet lifecycle verification, and concurrency testing remain required before release.
