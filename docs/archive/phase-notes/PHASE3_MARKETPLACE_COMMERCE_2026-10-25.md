# Phase 3 — Marketplace commerce reliability

Baseline: GH-CONNECT 0.90.2 Phase 2 archive. Source version: 0.90.3.

## Implemented

- Marketplace listing-fee quote endpoint now honors the explicitly selected fee currency, so UI/checkout can request a server-authoritative PI or GHC quote.
- New listing creation uses a stable listing ID. For PI listing fees, the client fetches the server quote, creates a durable PI payment intent bound to that exact listing, starts the official Pi U2A payment flow, and only submits the listing after the payment helper reports success. Cancellation/failure does not publish a listing.
- Listing-fee intent metadata includes listing ID and explicit listing-fee purpose markers; server-side verification still checks ownership, provider, status, amount, currency, and listing binding.
- Removed the duplicate marketplace publish request after successful durable creation. This was a likely source of mismatched fee-rail errors because the second request omitted the selected fee currency.
- Removed local-only listing creation fallback after an uncertain online/server/payment result. A failed or ambiguous server write is reported instead of being treated as a successful public listing.
- Checkout only offers the listing's actual currency rail. No unapproved PI↔GHC conversion rate is assumed; GHC-priced listings use GHC settlement and PI-priced listings use Pi payment-intent settlement.
- Improved payment copy to explain the selected currency and server-authoritative settlement.

## Verification performed

- JSX safety scanner: passed (772 files).
- Production safety scanner: 21 passed, 0 failed.
- Project truth checks: 10 passed, 0 failed.
- Release hygiene: 11/11 passed.
- Database source contract: passed (114 executable tables across 131 migrations).
- Live Pi Browser checkout, live GHC spend, multi-user order reservation races, and deployment build are not claimed as verified in this offline environment. Run Testnet end-to-end tests before release.

## Operator checks

1. Apply/reconcile the existing marketplace and payment-intent migrations individually against Testnet; do not bulk-push the migration directory.
2. Confirm `GHC_MARKETPLACE_LISTING_FEE_GHC` and `GHC_MARKETPLACE_LISTING_FEE_PI` are configured to approved Testnet values.
3. In Pi Browser, publish a PI-fee listing and verify intent completion, exact listing binding, and one public listing only.
4. Publish a GHC-fee listing with sufficient and insufficient balances; verify a single ledger debit on success and no listing activation on failure.
5. Test PI-priced and GHC-priced buyer orders using two accounts, including duplicate clicks, low balance, cancellation, expired inventory reservation, and reload/recovery.
