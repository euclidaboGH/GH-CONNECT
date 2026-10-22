# Phase 22 — Paystack NGN payout verification plan

Do not enable `PAYSTACK_TRANSFERS_ENABLED` until these checks pass in a disposable Supabase project and Paystack Test Mode.

1. Run `supabase/phase22_readonly_preflight.sql`; confirm the target migration history and inspect existing marketplace currency/payment rails.
2. Apply only `20261022010115_paystack_ngn_beneficiaries_and_payouts.sql` to a disposable database, then run `PHASE22_POST_MIGRATION_ASSERTIONS.sql`. `anon` and `authenticated` must not execute any of the payout RPCs; `service_role` must.
3. Create an NGN obligation only from a real, independently verified NGN revenue event through `gh_bank_payout_record_obligation`. A GHC/PI order must not be passed as an NGN funding source. Duplicate source reference with identical evidence is idempotent; conflicting amount, seller, type, or evidence must fail.
4. Test bank list, account resolution, and user-scoped beneficiary/payout history. Verify history returns only the authenticated seller's own records. Wrong account number, bank code, account-name mismatch, no recent step-up, duplicate beneficiary, missing fingerprint key, and provider timeout must fail closed. Raw account numbers must never be stored in GreenHaven tables or application logs.
5. Create a beneficiary in Paystack Test Mode and persist only provider recipient code, account holder name, bank details, HMAC fingerprint, and last four digits. Confirm RLS blocks all client reads/writes.
6. Request a payout against a matching available NGN obligation. Concurrent requests for the same obligation must result in exactly one reserved obligation and one request. A beneficiary belonging to another user must be rejected.
7. Operator approval may only move `requested` to `approved`; cancellation returns the obligation to `available`. No operator route can mark a request `paid`.
8. Execute an approved transfer with configured `PAYSTACK_MAX_TRANSFER_KOBO` and `PAYSTACK_DAILY_TRANSFER_LIMIT_KOBO`. Concurrent transfers must atomically reserve UTC daily capacity; per-transfer and daily-limit breaches must not call Paystack. The same request must reuse the same `ghb_...` provider reference after timeouts. A mismatched amount, currency, reference, provider transfer ID, or recipient must not be marked paid.
9. Deliver signed `transfer.success`, `transfer.failed`, and `transfer.reversed` webhooks. Verify invalid HMAC is rejected, duplicates are idempotent, a success atomically marks the obligation paid, and a reversal after success is recorded as reversed for manual review.
10. Simulate a lost webhook and run `reconcile-bank`. It must fetch current provider state using the saved reference; client-supplied status is never accepted. Pending provider status must remain unpaid.
11. Inject crashes before/after provider request, after provider response, before submission persistence, and during webhook handling. No new reference may be generated for an in-flight payout. Failed/reversed obligations remain reserved until an explicit audited operator resolution; no automatic duplicate transfer is allowed.
12. Live transfers require the provider account to be enabled for transfers, live credentials, approved webhooks, explicit `PAYSTACK_LIVE_TRANSFERS_APPROVED=true`, a real NGN funding source, limits, monitoring, and reconciliation sign-off.

## Current integration boundary

The repository currently has GHC/PI marketplace orders, not a verified NGN sales/settlement rail. Phase 22 adds the Paystack bank-transfer adapter and a strict NGN-obligation boundary, but it intentionally does not convert GHC/PI or create NGN liabilities from those balances. Until an upstream NGN revenue source exists and supplies audited obligation evidence, no bank payout request can be funded and the provider feature flag must stay off.
