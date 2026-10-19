# Phase 22 — Paystack NGN bank payout adapter (0.62.2)

## Delivered in source

- Added a server-only Paystack API adapter with strict HTTPS base URL, bounded request timeouts, structured errors, key-prefix validation, explicit feature gating, and separate live-transfer approval.
- Added authenticated bank-list and account-resolution routes. Account resolution requires recent step-up verification, validates Nigerian 10-digit NUBAN accounts, and returns a verified account-holder name without persisting the raw account number.
- Added beneficiary registration that resolves the account again immediately before creation, requires the submitted account-holder name to match the provider result, creates a Paystack `nuban` recipient, and stores only the recipient code, holder/bank name, HMAC account fingerprint, and last four digits.
- Added a strict NGN funding-obligation ledger boundary. Each payout request must consume an existing trusted, evidence-hashed NGN obligation; GHC/PI balances and existing GHC/PI orders are not converted into NGN.
- Added an idempotent request/approval/transfer lifecycle, stable provider references, server-side transfer initiation, signed HMAC-SHA512 webhook verification, event deduplication, and provider API reconciliation for missed webhooks.
- The transfer submission response can never mark a payout paid. Only a matching signed provider webhook or authenticated server-side provider reconciliation can mark the obligation paid. Reversals are recorded and held for manual review.
- All payout RPCs are revoked from `PUBLIC`, `anon`, and `authenticated` and granted only to `service_role`; beneficiary, obligation, payout, webhook and reconciliation tables have RLS with no client access.
- Added source checks, read-only Supabase preflight, post-migration privilege assertions, and a concurrency/failure-injection plan.

## Environment variables (server-only)

- `PAYSTACK_SECRET_KEY`: Paystack test key initially; never expose with `NEXT_PUBLIC_`.
- `PAYSTACK_TRANSFERS_ENABLED=false`: keep disabled until Test Mode and database verification pass.
- `PAYSTACK_LIVE_TRANSFERS_APPROVED=false`: must be explicitly enabled only after live risk/compliance sign-off.
- `PAYSTACK_MAX_TRANSFER_KOBO` and `PAYSTACK_DAILY_TRANSFER_LIMIT_KOBO`: required positive integer limits in kobo; database reservation is atomic per UTC day and retries do not reserve capacity twice.
- `GHC_BENEFICIARY_FINGERPRINT_KEY`: at least 32 characters of high-entropy server-only secret, used to HMAC bank/account fingerprints.
- `GHC_PAYOUT_RECONCILIATION_KEY`: high-entropy operator key for approval, execution and provider reconciliation endpoints.

Configure the Paystack dashboard webhook URL to `/api/webhooks/paystack`. Paystack's transfer webhook signature is verified against the configured secret key. Do not disable provider OTP or change transfer settings without an approved operational policy.

## Critical funding boundary

The current marketplace order schema uses GHC/PI and does not provide a verified NGN revenue rail. Phase 22 intentionally does not convert GHC/PI into NGN and does not mint a bank payout obligation from an ordinary order. `gh_bank_payout_record_obligation` must be called by a trusted upstream NGN revenue/settlement integration with a unique source reference and SHA-256 evidence hash. Until that source exists and has been audited, the bank adapter can support provider/beneficiary validation but cannot be considered end-to-end ready for seller payouts. The feature flag remains off.

## Verification status

- Phase 22 source-level checks: 38/38 passed at authoring time.
- Migration is not applied to Supabase; SQL privilege and concurrency assertions are prepared but not run against a live database.
- No Paystack credentials are available in this workspace; no live/test transfer was initiated.
- The project dependency lock is still incomplete for the newly added `pi-backend@0.1.3` package because both npm registry endpoints failed DNS resolution in this environment. A registry-connected Node 22.22.2+ or 24.15.0+ environment must refresh the lock and run the full clean install/typecheck/lint/CI/build gate.
