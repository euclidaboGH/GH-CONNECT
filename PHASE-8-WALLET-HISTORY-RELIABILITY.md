# Phase 8 — Wallet history reliability foundation (v0.97.0)

## Scope
This is the first of three wallet-wide upgrade phases. It starts with transaction-history correctness and transparent failure handling before changing shared payment contracts or financial data models.

## Implemented
- Pi payment history no longer silently looks empty when the endpoint returns an HTTP error or the network fails.
- Added a visible, accessible failure state and a retry action that re-requests authoritative server history.
- Preserves previously loaded history on fetch failure instead of replacing it with an empty array.
- Added text search for Pi history by purpose, product, intent ID, payment ID, and status; date range remains available.
- Kept Pi payment intents and the GHC ledger visually separated. Asset balances are not aggregated across rails.
- Added a network/database-independent source contract checker for history failure states, retry, user-scoped API access, no-store response, and rail separation.

## Security and financial invariants
- No client-side balance minting or financial status mutation was added.
- The existing authenticated GET route continues to derive user identity server-side and list only that user's payment intents.
- No migration, live payment, wallet mutation, refund, or provider completion was performed.
- Missing history is not fabricated; if the API is unavailable, the UI says so.

## Verification
Run `npm run check:phase8-wallet-history`. Also run `npm run verify:static`, `npm run test:safety`, `npm run check:dependency-lock-integrity`, and then the supported Node 24 typecheck/build suite.

## Known limitations carried into phases 2–3
- Pi payment intents and GHC ledger entries still live in separate views; this phase does not yet provide a normalized cross-feature statement.
- The server-side history endpoint returns payment intents; complete product fulfilment, group creation, curation, utility, membership, and marketplace reconciliation still requires a source-by-source audit and integration tests.
- A green source checker does not prove the remote Supabase schema, RLS policies, provider configuration, or deployed runtime is correct.

## Three-phase wallet plan
1. **Phase 8 — History reliability:** clear loading/empty/error states, search, retry, release checks, safe user-scoped retrieval.
2. **Phase 9 — Canonical transaction integration:** map all existing authoritative transaction/payment sources to a stable read-only transaction view; normalize status/category/reference/timestamps; deduplicate by authoritative IDs; reconcile intent/payment/order/entitlement fulfilment; retain separate asset rails and currencies.
3. **Phase 10 — Fintech-grade experience and verification:** transaction detail/receipts, robust filters and pagination, pending/retry guidance, cross-feature deep links, responsive accessibility/performance, authorization/duplicate/concurrency/settlement tests, deployment and two-account Testnet verification.

No database migration should be applied to a remote environment until the actual migration history, schemas, grants and RLS policies have been inventoried and reconciled.
