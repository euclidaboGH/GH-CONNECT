# Phase 3 — Company revenue and payment reconciliation foundation

**Status:** source implementation only; not deployed, and migration not applied.

## What this adds

- `gh_company_revenue_events` is a separate, append-only journal for verified company-revenue evidence.
- Amounts are stored as integer minor units per currency, not floating point. For NGN, that means kobo.
- The database computes company net as company revenue minus provider fees and tax.
- Both a caller idempotency key and `(source_provider, source_event_id)` are unique. Retries with the same exact economic facts are idempotent; conflicting facts are rejected.
- Anonymous and authenticated client roles receive no table or RPC access. Only the service-role append RPC is granted; application roles cannot update/delete journal rows.
- `lib/server/revenue/revenue-event.ts` provides server-side validation and a typed RPC adapter.

## Accounting boundaries

- This journal is **not** the GHC utility ledger, seller balance, seller payout obligation, or payment-intent store.
- A GHC spend/transfer/reward is not automatically company revenue.
- Gross order value is not automatically company revenue: seller proceeds, platform fee, provider fee and tax must be classified separately.
- A browser success screen, client-supplied transaction ID, unverified webhook, or pending provider response is not settlement evidence.
- Record events only after a provider-specific server integration has verified the source and after the business accounting policy defines recognition timing. Do not call this adapter from a user-controlled route.
- Refunds and chargebacks are separate negative events. Never edit or delete a previously recorded event to hide a reversal.
- Keep metadata minimal and non-sensitive; use opaque internal references. Do not store bank details, credentials, full provider payloads, personal information, or access tokens.

## Deliberately not enabled in this phase

This phase does not create a public revenue dashboard, new checkout method, Pi-to-GHC conversion, automatic payouts, a Paystack collection/webhook flow, tax treatment, or new fee rates. Existing payment/entitlement flows are not changed to write this journal yet because correct accounting requires a transactional outbox or an atomic database operation at each source-of-truth settlement point. A non-atomic post-success insert could leave a paid order without a revenue event, or double count on retries.

## Additional hardening in the 0.63.25 re-review

- The journal now rejects row updates and deletes at the database trigger layer; corrections must be compensating events.
- Metadata is restricted to JSON objects and capped at 4 KiB by PostgreSQL, as a second boundary beyond the adapter's allow-listed metadata projection.
- The server adapter validates event/provider enums at runtime instead of trusting TypeScript types alone.
- The adapter retries a unique-key concurrency race once so the database can return the canonical idempotent result. It still returns a fail-closed error if the retry cannot reconcile the row.

## Required before integration or deployment

1. Review this migration against the exact Testnet schema/history and apply only to disposable PostgreSQL first.
2. Test SQL syntax, RLS/grants, immutable permissions, duplicate and concurrent inserts, conflicting idempotency keys, refunds, chargebacks, and integer boundaries.
3. Build a provider-specific verifier and atomic/outbox handoff for each approved revenue source.
4. Reconcile provider gross/fees/refunds/chargebacks against accounting statements and define tax/currency policy.
5. Run clean dependency install under supported Node 24, TypeScript, lint, build, complete regression suite, and Testnet two-account tests.
6. Obtain explicit product, finance, legal and release approval before any live integration.

## Future Cloudflare boundary

See `docs/CLOUDFLARE_R2_GLOBAL_MEDIA_ARCHITECTURE.md`. The current Supabase Storage path remains active. R2 is not switched on by adding environment variables alone; migration needs a tested provider adapter and authorized private-object delivery.
