# Run #302 — Pi wallet-scope consent and A2U withdrawal fix (candidate)

Baseline: 0.338.85; corrected source candidate: 0.338.86. Testnet migration applied and verified on 2026-11-16. No GitHub push or Vercel deployment performed. Production remains NOT APPROVED.

## Symptom (from the recorded device video)
Pi Browser showed the wallet-address permission prompt, the user tapped Allow, and GreenHaven then reported "Pi did not return a wallet address". Withdrawal could never start.

## Root cause
The consent gate accepted a wallet only if Pi's Platform API `/v2/me` returned an address and required source `platform_api` everywhere (server consent, grant service, status, payout assertion, read-back, client). Pi's documented `/me` UserDTO carries `uid`, `credentials.scopes` and `username` — not the wallet address. The address is exposed on the A2U `PaymentDTO.to_address`. The gate therefore could not pass whenever the SDK also returned no address.

## What changed
- `/v2/me` is now used for what it does prove: `credentials.scopes` must contain `wallet_address` for the fresh token. A browser claim never authorizes by itself.
- Three outcomes, all bound to the server-verified, durably mapped Pi UID: address from `/v2/me` (`platform_api`); SDK address after scope proof (`pi_sdk_scope`, provisional); scope granted but no address (`scope_only`).
- Payout worker: after Pi creates the A2U payment it reads `to_address`. With no bound address it adopts Pi's value through the new `gh_pi_wallet_authorization_adopt_provider_address` RPC; with a bound address any difference blocks the payout and queues operator review. Nothing is submitted before a valid provider address is bound to the request.
- New migration `20261116045934_pi_wallet_scope_consent_provider_address_discovery.sql` (applied to Testnet): `wallet_scope_verified_at`, updated grant/get/assert/create RPCs, strict provider-payment-bound adopt RPC and service-role-only compatibility adapter. Historical backfill is restricted to explicit user-consent provenance and valid recognized address sources; UID-only and unproven rows must re-consent.
- Server logs a booleans-only shape line for each consent (`scopeGranted`, `sdkAddressPresent`, `platformAddressPresent`) so a failed attempt shows which side lacked the data. No tokens, UIDs or addresses are logged.
- UI/copy updated for the pending-address state and the new `PI_WALLET_SCOPE_NOT_GRANTED` error.

## Follow-up (device video 2)
The deployed preview still showed "Pi did not confirm wallet-address access". Consent responses now carry a secret-free `build`, `stage` and `diagnosticCode`, and the app appends them to the on-screen error as `(diagnostic: run302-scope-consent-v3 · STAGE · CODE · HTTPnnn)`. A database that has not received the migration is reported as `WALLET_SCOPE_MIGRATION_REQUIRED` (operator action) instead of telling the user Pi withheld access. If the on-screen error has no `run302-scope-consent-v3` marker, the preview is not running this build.

## Preserved protections
Explicit consent; no account-ID-as-address; no browser-supplied recipient; Testnet only; idempotency, lease fencing, single active request, uncertain-payment holds, independent receipt verification and ledger settlement checks.

## Operator steps
1. Testnet migration `20261116045934` was applied as a single migration after confirming prerequisite `20261110125500`; do not use `db push`.
2. Deploy this source; confirm `wallet_address` is enabled for GreenHaven in the Pi Developer Portal.
3. Re-consent in Pi Browser, then watch the `[wallet-consent] pi proof shape` log line.
4. Run one small Testnet withdrawal and confirm the provider receipt.

## Open risk
If Pi's `/v2/me` does not report `wallet_address` in `credentials.scopes` even after the user allows it, consent fails closed with `PI_WALLET_SCOPE_NOT_GRANTED`; the log line will show that. This was not testable offline.

## Verification
`npm run verify:static` equivalent: all 314 steps pass on Node 22 (Run #302 gate extended to 31 assertions; wallet consent tests 15/15). Changed library files typecheck clean in isolation. Full Node 24.15.0 install/typecheck/lint/build, the migration on PostgreSQL, and a live Testnet payout remain outstanding.

## Update (second device recording)
The deployed build showed "Pi did not confirm wallet-address access" without a second Pi prompt. Because the consent proof had already passed server-side, the most likely cause is the Supabase grant function still predating the migration (it rejects a blank address). The grant path now reports `WALLET_SCOPE_MIGRATION_REQUIRED` and logs the migration file name in that case. See `docs/PI-A2U-TESTNET-TO-MAINNET-READINESS-RUN302.md` for the official A2U and Mainnet requirements.


## Run #302 security correction (0.338.86)

- Historical scope-verification backfill is restricted to rows with `consent_source = 'user_explicit'`, a recognized wallet-address source, and a valid Pi address. An address by itself is not evidence of wallet-scope consent.
- Provider destination adoption now locks and validates the current Pi identity mapping and payout request, requires `Pi Testnet`, requires an executable payout state, and requires the exact provider payment ID already bound to the request.
- Wallet address source validation explicitly rejects NULL.
- The strict five-argument RPC is used by the updated worker. A service-role-only four-argument compatibility adapter reads the already-bound provider payment ID from the payout row and delegates to the strict RPC, so the previously deployed worker does not fail during the rollout window.
- No payout/ledger rows are reset or deleted. Existing UID-only authorizations remain unverified and must be re-consented.
- Static Run #302 regression checks: 35/35 pass. This is source-level evidence only; a successful Testnet migration does not itself prove a live Pi A2U transfer.


## Testnet application result (2026-11-16)

- Supabase Testnet migration history records `20261116045934_pi_wallet_scope_consent_provider_address_discovery`.
- `wallet_scope_verified_at` exists; both strict five-argument and compatibility four-argument adoption RPCs exist.
- Both RPC overloads are executable by `service_role` only; `anon` and `authenticated` have no execute privilege.
- No authorization was auto-verified by the provenance backfill (0 rows); the current UID-only consent remains pending re-consent.
- All 13 historical released payouts remain without provider IDs/txids; no active payout requests existed at verification time. No payout or ledger rows were changed by the migration.
- Supabase security advisor still reports 13 pre-existing RLS-enabled/no-policy informational findings on unrelated tables; no new finding was attributed to this migration.
- Run #302 static hardening checks: 35/35 pass. Full dependency-backed build, live Pi Testnet A2U transfer and deployed Preview verification remain outstanding.
