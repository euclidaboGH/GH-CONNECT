# GreenHaven 0.338.26 — Run #260 Pi wallet and withdrawal reliability

Date: 2026-11-10

## Baseline and live evidence

Derived from the current working 0.338.25 project, itself derived from the user's authoritative `GREENHAVEN-0.338.23-RUN257-ECONOMY-MARKETPLACE-RECONCILIATION.zip`.

Connected Vercel confirms Testnet Preview deployment `dpl_HMcWzp1ma76wqdJMdGrgNpq5JcWs` is READY on commit `237070b2817680933b82994ca72737bd1e90d505` (package version 0.338.25, Node 24.x). The live `/api/economy/earnings/withdrawals/process` request returned 503; the old worker logged only `PI_PROVIDER_OUTCOME_UNCERTAIN` without provider stage/status/code.

Connected Testnet read-only inspection found three 1.00 π requests in `uncertain`, each with a 0.03 π fee, 0.97 π net, no persisted Pi provider payment ID, no txid and no verified receipt. The total 3.00 π remains reserved. The linked Pi UID and explicit authorization are active and match. The current authorization schema does not store a blockchain wallet address.

## Source changes

1. Added `lib/server/payments/pi-platform-a2u.ts`, a bounded direct read-only Pi Platform incomplete-A2U query. This bypasses the pinned SDK method that masks all incomplete-payment lookup errors as `unknown_error`; only safe HTTP/provider codes are retained.
2. Added exact execution-stage diagnostics and safe provider status/code logging to the earnings A2U worker. Raw provider messages, API keys, UIDs and wallet seeds are never logged or returned.
3. Added the read-only incomplete-A2U lane probe and a no-payment Pi SDK/server-seed initialization probe to `/api/health/withdrawals`; updated the operator Treasury inspector to use the same safe adapter.
4. Added a single-active-withdrawal guard to `gh_pi_earnings_payout_create`; a new request is blocked while the same user has a `reserved`, `processing` or `uncertain` request. Existing active rows are not modified.
5. Extended explicit Pi wallet consent to request the official `wallet_address` scope. The official Pi SDK returns the address under the explicit `wallet_address` scope. The server verifies the token UID; if `/v2/me` also returns an address it must match. Otherwise the official SDK value is marked `pi_sdk_scope`, and Pi PaymentDTO `to_address` must match it before submission. No arbitrary user-entered address is accepted.
6. Upgraded the Wallet UI to show a masked Pi-reported public wallet address with a copy control and a clear source label (`Pi SDK`, `Pi API`, or `Provider-confirmed`), separate from the app-specific UID used by A2U.
7. Added a per-request “Reconcile this Pi payout” action for existing `uncertain` reservations. It calls the authenticated process route, which can resume only an exact matching incomplete provider payment and otherwise refuses to create a replacement.
8. Updated withdrawal messaging to surface safe provider diagnostics and warn against creating another request while the first remains unresolved.

## Migration

Added `supabase/migrations/20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics.sql`.

- Adds nullable public wallet-address and verification timestamp fields to the private authorization table.
- Makes legacy 3-argument UID-only grants fail closed; new grants require a Pi SDK/API wallet address bound to the server-verified UID; the provider's actual destination must match before submission and settlement.
- Requires a bound Pi wallet address in payout authorization and a provider `to_address` match before submission/settlement.
- Replaces the payout-create RPC with an advisory-lock-protected one-active-request guard.
- Keeps all sensitive table/RPC access service-role-only and pins `search_path`.

The migration is classified REVIEW_REQUIRED and has NOT been applied. It must be reviewed and applied to Testnet only after 0.338.26 is deployed and the full target migration history is reconciled. It intentionally requires users with legacy UID-only consent to re-consent in Pi Browser before creating a new payout.

## Verification

Verification is source-level/static and uses the available Node 22.16.0 runtime; the project requires Node 24.15.0. No `node_modules`, `psql`, Docker or Supabase CLI are available in this workspace. A global `tsc --noEmit` attempt cannot resolve React/Next/Node type packages without the project dependencies, so this run does not claim a dependency-backed typecheck, lint, PostgreSQL migration execution or Next.js build for 0.338.26.

- Run #260 source contract: 25/25.
- Phase 28 wallet consent runtime tests: 12/12.
- Phase 28 wallet consent source contract: 41/41.
- Withdrawal health source contract: 25/25.
- Migration inventory regenerated: 208 SQL files (120 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 85 REVIEW_REQUIRED).
- Full `npm run verify:static`: PASS (exit 0). Run #260 contract: 25/25. Phase 28 consent runtime: 12/12; source contract: 41/41. Withdrawal health contract: 25/25. SQL lexical integrity: PASS (208/208). Migration inventory check: PASS (208 files: 120 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 85 REVIEW_REQUIRED). Documentation hygiene: PASS. Release hygiene: 13/13. Project truth: 11/11. ZIP integrity: PASS (`GREENHAVEN-0.338.26-RUN260-PI-WALLET-WITHDRAWAL-REPAIR.zip`, 2,231 files; `unzip -t` PASS).

## Explicitly not done

- No existing payout request, reservation, balance or ledger entry was changed.
- No Pi payment was created, submitted, cancelled, completed or settled.
- No uncertain reservation was released.
- No wallet seed, API key or other secret was read into the working context or exposed.
- No Supabase migration was applied in this run.
- No GitHub push or Vercel deployment was performed for 0.338.26.
- Mainnet was not accessed or modified.

## Remaining gates

1. Deploy source 0.338.26 to Testnet Preview.
2. Run `/api/health/withdrawals` and inspect the new `pi_incomplete_a2u` component. Use operator Treasury `exceptions.piProviderIncomplete` for exact redacted provider metadata.
3. Reconcile all three uncertain requests against Pi's authoritative provider payment/history state. Do not retry or release until exact provider evidence exists.
4. Review and apply the additive migration to Testnet, then re-consent with `wallet_address` scope and verify the address is returned by Pi `/v2/me` for the same UID.
5. Run one small controlled Testnet payout and verify provider ID, UID, amount, network, txid, transaction verification, developer completion and ledger settlement. Confirm the one-active-request guard prevents duplicate reservations.
6. Complete dependency-backed Node 24.15.0 typecheck/lint/build, browser/device/two-account acceptance and independent Mainnet review before production approval.

Production remains NOT APPROVED.
