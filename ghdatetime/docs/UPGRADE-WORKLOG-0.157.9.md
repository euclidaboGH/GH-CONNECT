# GreenHaven v0.157.9 — Phase 10 marketplace mutation hardening

Date: 2026-10-28
Baseline: `GREENHAVEN-0.157.8-PHASE9-TRANSACTION-INTEGRITY-2026-10-28.zip`

## Changes

- Marketplace order creation now reads JSON with the shared streaming body limiter (16 KiB) and rejects malformed/oversized bodies.
- Quantity must be a JSON number that is a safe integer from 1 through 99. Strings, booleans, fractions, zero, negatives, and oversized values are rejected rather than coerced or silently defaulted.
- Listing identifiers must be strings, are trimmed and bounded to 160 characters, and reject control characters.
- Payment, transition, and commerce mutations use bounded JSON parsing (8 KiB) before interpreting action fields.
- Commerce action and note fields are accepted only as strings; objects and other values are not coerced to text.
- Mutation responses use `Cache-Control: no-store` on success and validation/authorization failures where updated.
- Expanded the Phase 10 source-contract checks for body limits, strict quantity handling, identifier bounds, payload typing, and cache headers.
- Synchronized package, lockfile, application release, manifest, README, project-truth, and consolidated acceptance documentation to v0.157.9.

## Preserved boundaries

- Listing price, seller, currency, stock and availability remain server/database derived.
- Inventory reservation and order idempotency remain owned by the durable transactional RPC.
- Public transitions cannot establish payment verification; paid fulfilment remains gated on authoritative payment state.
- Buyer/seller authorization and payment-versus-fulfilment separation remain in place.
- No migrations were added and no live database, Pi environment, or production deployment was modified.
- Official GreenHaven and GHC brand assets were not edited.

## Verification boundaries

Source-contract checks are intended to be network/database independent. They do not prove concurrency behavior in PostgreSQL, live payment settlement, runtime build health, or browser acceptance. Run the supported Node.js 24.15.0 locked install, TypeScript, lint, production build, disposable database concurrency tests, and authorized Testnet journeys before release.
