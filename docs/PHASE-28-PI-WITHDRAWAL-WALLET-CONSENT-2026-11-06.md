# Phase 28 — Pi Testnet withdrawal: genuine wallet consent before quote (2026-11-06)

Baseline: package 0.315.4 (Phase 24 final source and migration review, 2026-11-04).

Scope: Pi **Testnet** only. No Mainnet configuration, database or payment infrastructure is touched.
No SQL migration is required: the database functions, RLS and least-privilege grants were already correct
and are unchanged (`gh_pi_wallet_authorization_*` and `gh_earnings_quote_withdrawal` remain `service_role` only).

## Root cause (confirmed from source)

`WALLET_AUTHORIZATION_REQUIRED` came from `gh_earnings_quote_withdrawal`, which was behaving correctly.
The application reached it incorrectly:

1. **Quote reachable before consent.** In `components/ghc/pi-withdraw-sheet.tsx` the *Preview fee* button was enabled
   while no authorization existed and called `/api/economy/earnings/quote` directly.
2. **Consent step was not genuine.** "Authorize & continue" posted an empty `{}` to
   `/api/identity/wallet-authorization`; no `Pi.authenticate()` and no server-side Pi verification took place.
   The route trusted the existing identity mapping alone, so the dialog could not satisfy "fresh, genuine Pi consent".
3. **No continuation.** After consent the user had to press *Preview fee* again; failures surfaced as
   `HTTP 409: CODE` strings or were all collapsed to the authorization-required message.
4. The wallet dashboard had a second, separate blind `POST {}` authorization path.

`wallet authorization records = 0` with 3 complete identity mappings is consistent with the consent step never
completing a verified grant; the payout request stage was never reached.

## What changed

| File | Change |
| --- | --- |
| `lib/server/identity/wallet-consent.ts` (new) | Pure, injectable verification: literal `consent === true`, fresh Pi token verified via Pi Platform `/v2/me`, verified UID must equal the durable `gh_pi_identities` mapping of the session account **and** resolve back to that same account. Safe messages + HTTP status map. |
| `app/api/identity/wallet-authorization/route.ts` | POST now requires `{accessToken, consent:true}`, calls `verifyWalletConsentProof` before `gh_pi_wallet_authorization_grant`, uses only `user_explicit`, reads back via the status RPC, returns structured safe errors. GET/DELETE unchanged. |
| `lib/client/pi-wallet-consent.ts` (new) | `Pi.authenticate(["username","payments"])` → POST → independent status read-back. Distinguishes cancelled / unverifiable / mismatch / save-failed. Token is never stored. |
| `components/ghc/pi-withdraw-sheet.tsx` | Quote only after DB-confirmed active + UID-matching authorization; Preview fee disabled until then; consent dialog (linked username, 3% fee, linked-identity-only statement, checkbox, Authorize & continue, Retry, Cancel); success auto-continues to the quote; submit requires a quote for the exact amount; stale quotes cleared on amount change; one idempotency key per withdrawal intent; limit/balance errors show real figures. |
| `components/ghc/pi-payout-authorization-card.tsx` | Uses the same consent helper and a consent checkbox. |
| `components/ghc/unified-earnings-dashboard.tsx` | Removed the blind authorize path; hands off to the sheet when authorization is missing. |
| `app/api/economy/earnings/quote/route.ts`, `lib/server/earnings/unified-ledger.ts` | Failure responses forward safe limit hints (available/min/max atomic). Quote still delegates to the DB function. |
| `scripts/test-phase28-wallet-consent.mjs`, `scripts/check-phase28-wallet-consent-flow.mjs` (new) | 9 runtime contract tests + 23 static gates; registered in `prebuild` and `verify:static`. |
| `scripts/check-phase2-…`, `check-wallet-phase4-…`, `check-wallet-a2u-production-readiness.mjs` | Assertions that encoded the old blind-POST behaviour updated to the new contract. |

## Payout pipeline audit (no changes made)

`withdrawals` route: quote (DB authorization check) → `assertPayoutWalletAuthorization` → idempotent create with a
request fingerprint. `withdrawals/execute`: re-asserts authorization, acquires the A2U lease, binds the provider
payment, independently verifies the Pi receipt, settles only with verified evidence, retains the reservation and
never re-creates a payment on an uncertain outcome. Fee = `ceil(gross × 300 / 10000)`, net = gross − fee, atomic
scale 10,000,000 — identical in SQL, server preview and client preview.

## Testnet deploy

1. Apply nothing in Supabase (no new migration).
2. Replace the project with this archive, commit to the `testnet` branch, push; let the Vercel Preview build run
   (Node 24.15 per `.nvmrc`; the `prebuild` chain now includes the two Phase 28 gates).
3. In **Pi Browser** open the Preview, sign in with Pi, open Wallet → Withdraw, tick consent, **Authorize & continue**,
   approve the Pi consent screen. The quote should appear automatically.
4. Verify read-only in Supabase: one `gh_pi_wallet_authorizations` row, `status='active'`, `pi_app_uid` equal to
   `gh_pi_identities.pi_app_uid`, and a `consent_granted` row in `gh_pi_identity_link_events`.
5. Payout execution still requires the existing Testnet flags (`PI_EARNINGS_PAYOUT_REQUESTS_ENABLED`,
   `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED`, `PI_A2U_ENABLED`, `PI_A2U_TESTNET_ONLY`).
