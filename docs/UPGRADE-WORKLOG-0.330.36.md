# Upgrade worklog — 0.330.36

## Scope

Phase 9.2 Marketplace Seller Centre and descriptive product option foundations, built on 0.330.35.

## Implemented

- Seller Centre low-stock, draft and catalog-quality indicators, plus improved order-attention state recognition.
- Bounded product option parser and seller authoring format (`Name: value, value`), up to four groups and twelve values per group.
- Durable option metadata round-trip through the existing listing JSON metadata, mapper and API projection. Older clients that omit product options preserve existing values on edit.
- Buyer listing details explain that options share the listing price and stock and provide a message-to-confirm path.
- Release metadata, roadmap, current build context and Phase 8 release gate reconciled to 0.330.36.

## Checks run

- Phase 9.2 static contracts: 9/9 PASS.
- Product option parser assertions: 9/9 PASS.
- Phase 9 Marketplace transformation: 20/20 PASS.
- Priority 8 messaging transformation: 49/49 PASS after updating the release-version contract.
- Consolidated `npm run verify:static`: attempted; first run stopped on the stale release-version contract, then the next run found missing/current-release documentation reconciliation. Repeat after reconciliation.

## Limits and safety

This worklog records source-only verification, not deployment acceptance.

The environment has Node.js 22.16.0, the repository requires Node.js 24.15.0, and `node_modules` is absent. The existing Phase 9 runtime contract also cannot import TypeScript through the repository `@/` alias in this Node 22 environment. Typecheck, lint, Next.js build, browser/device, live Supabase, disposable PostgreSQL concurrency, Pi/Testnet and operator acceptance have not been completed.

No database migration was added or applied. Product options are descriptive only and share listing price and stock; no independent SKU inventory or pricing is claimed. Production remains NOT APPROVED.
