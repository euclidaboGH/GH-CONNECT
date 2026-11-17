# GreenHaven 0.338.22 — Run #256 upgrade worklog

## Scope

Derived only from the user-authoritative `GREENHAVEN-0.338.21-RUN250-255-TESTNET-SECURITY-RECONCILIATION.zip`. This increment focuses on Pi earnings A2U withdrawal observability and the operator path for an unrelated incomplete Pi server-side payment.

## Changes

- The earnings payout worker now enqueues an unrelated incomplete A2U payment into the existing service-role-only shared review queue, including the provider payment ID, txid (when present), and bounded domain/request metadata.
- The worker never cancels, submits or completes an unrelated payment. It retains the current request reservation and returns a clear review-required result.
- The worker persists a sanitized diagnostic code instead of overwriting every failure with one generic code, and no longer returns raw provider exception text to the browser.
- The operator treasury summary now performs a read-only Pi Testnet `getIncompleteServerPayments()` inspection when the explicit Testnet gates and server credentials are present. It returns only bounded metadata and status flags, never the recipient UID or secrets.
- Wallet copy now explains the global incomplete-A2U blocker without implying that the new payout was sent.
- The exact `PI_A2U_TESTNET_ONLY=true` setting is corrected in the environment example and operator checklist.
- Current source-truth, release, migration and incident documents are updated. No new SQL migration was required; the existing A2U review queue and service-role RPCs are reused.

## Verification

This is source-only verification plus isolated live Testnet read-only/operator-queue inspection; it is not a production acceptance certificate.

- Run #256 A2U review-queue contract: 12/12.
- Pi earnings execution-worker contract: 21/21.
- Shared A2U orchestration contract: 11/11.
- Withdrawals health contract: 23/23.
- Project truth: 11/11.
- Migration source manifest: 206/206.
- SQL lexical integrity: 206 migrations passed.
- Full `npm run verify:static`: pending final rerun after release-document synchronization.

## Live Testnet action

- Added the existing uncertain earnings payout (`534bb470-5702-49da-a5e2-47bfce7aac13`) to the existing A2U operator review queue using `gh_pi_a2u_review_enqueue`. This is an operational review record only; it does not change the payout request, ledger, balance, reservation, or Pi provider state.
- No Pi provider payment was created, submitted, cancelled or completed.
- No balance, ledger or payout reservation was released or settled.
- Mainnet was not accessed.

## Limitations and release decision

The actual Pi incomplete server-side payment could not be inspected from this session because the Vercel deployment connector is not connected. The queue record and new operator diagnostic make the next step explicit, but the uncertain request must remain reserved until the provider outcome is reconciled. The available runtime is Node.js 22.16.0; the project requires Node.js 24.15.0. Therefore this worklog does not claim dependency-backed TypeScript, lint or Next.js production build success. Marketplace SKU/fulfilment migrations, disposable PostgreSQL concurrency, real Pi Testnet withdrawal, browser/device, and production acceptance remain open. **Production remains NOT APPROVED.**
