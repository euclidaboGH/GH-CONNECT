# GreenHaven 0.338.23 — Run #257 economy and Marketplace reconciliation

## Source baseline

Derived only from the latest user-authoritative `GREENHAVEN-0.338.21-RUN250-255-TESTNET-SECURITY-RECONCILIATION.zip`. This release carries Run #256 Pi A2U diagnostics forward and adds a focused source-level contract for Marketplace inventory, payment and fulfilment boundaries.

## Delivered

- Added a 15-point Marketplace source contract covering authenticated order creation, untrusted client price rejection, variant-aware atomic reservation, legacy-RPC bypass prevention, stock commit/release, GHC atomic spend, Pi payment-intent binding, ambiguous payment recovery, immutable event journal reuse, shipping dispatch, delivery and buyer confirmation.
- Extended the Pi A2U withdrawal contract to catch malformed nested wallet message quoting; the diagnostic action label is now safely quoted.
- Updated migration inventory generator notes with the exact Testnet preflight findings. SKU variants and fulfilment migrations remain REVIEW_REQUIRED and unapplied.
- Updated Testnet reconciliation records for membership, Daily Claim, referral, cashback and Marketplace evidence.

## Live Testnet operator records

- One open shared A2U review record for the uncertain earnings payout (`534bb470…`), which has no provider payment ID or txid.
- One critical Treasury case for two old APPROVED Pi membership intents without txid/completion/entitlement.
- One high-priority Treasury case for two pending Daily Claim V12 entries older than 48 hours.
- No balance, ledger, payment intent, entitlement, reservation or provider payment was changed by these case records.
- Marketplace preflight: 8 listings (1 active, 3 paused, 4 removed), 0 orders, 0 seller payouts. The only fulfilled Marketplace Pi intent is a listing fee linked to an existing listing. Variant schema is absent; existing base RPCs and Phase 21 journal prerequisites are present.

## Verification

- Run #256 Pi earnings A2U review-queue source contract: 13/13.
- Run #257 Marketplace/payment/fulfilment source contract: 15/15.
- `scripts/check-project-truth.mjs`: PASS 11/11; migration manifest: PASS 206/206; SQL lexical integrity: PASS 206/206.
- Full `npm run verify:static`: PASS (exit 0; 287 prebuild checks retained).
- `tsc --noEmit` was attempted with globally available TypeScript 5.8.3 but dependencies/types are absent (`react`, `next`, `@types/node`, etc.); after the wallet quote syntax correction there were no remaining TS parser diagnostics, but dependency-backed typecheck is not certified. Project requires Node 24.15.0; this environment has Node 22.16.0.

## Outstanding production gates

- Inspect the actual Pi incomplete server-side payment through Vercel/Preview using the new read-only operator diagnostic; reconcile by the owning A2U domain.
- Verify the two approved membership intents with Pi provider receipts before activation/cancellation.
- Reconcile two aged Daily Claim rows using the correct server-side idempotent path.
- Validate migrations 194–195 on disposable PostgreSQL, then apply to Testnet only after explicit operator promotion; exercise variant oversell, cancellation/expiry, GHC spend, Pi intent binding, shipping dispatch, pickup/digital delivery, buyer confirmation and event journal.
- Run Node 24.15.0 dependency-backed typecheck, lint, production build, browser/device and two-account tests. Mainnet remains untouched. **Production remains NOT APPROVED.**
