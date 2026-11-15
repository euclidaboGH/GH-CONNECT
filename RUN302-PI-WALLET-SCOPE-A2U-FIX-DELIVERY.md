# Run #302 — Pi wallet-scope consent and A2U withdrawal fix (candidate)

Baseline: 0.338.85. Not applied, pushed or deployed by this run. Production remains NOT APPROVED.

## Symptom (from the recorded device video)
Pi Browser showed the wallet-address permission prompt, the user tapped Allow, and GreenHaven then reported "Pi did not return a wallet address". Withdrawal could never start.

## Root cause
The consent gate accepted a wallet only if Pi's Platform API `/v2/me` returned an address and required source `platform_api` everywhere (server consent, grant service, status, payout assertion, read-back, client). Pi's documented `/me` UserDTO carries `uid`, `credentials.scopes` and `username` — not the wallet address. The address is exposed on the A2U `PaymentDTO.to_address`. The gate therefore could not pass whenever the SDK also returned no address.

## What changed
- `/v2/me` is now used for what it does prove: `credentials.scopes` must contain `wallet_address` for the fresh token. A browser claim never authorizes by itself.
- Three outcomes, all bound to the server-verified, durably mapped Pi UID: address from `/v2/me` (`platform_api`); SDK address after scope proof (`pi_sdk_scope`, provisional); scope granted but no address (`scope_only`).
- Payout worker: after Pi creates the A2U payment it reads `to_address`. With no bound address it adopts Pi's value through the new `gh_pi_wallet_authorization_adopt_provider_address` RPC; with a bound address any difference blocks the payout and queues operator review. Nothing is submitted before a valid provider address is bound to the request.
- New migration `20261115100001_pi_wallet_scope_consent_provider_address_discovery.sql` (REVIEW_REQUIRED): `wallet_scope_verified_at`, updated grant/get/assert/create RPCs, new adopt RPC (service_role only). Rows that already hold an address are backfilled as scope-verified; legacy UID-only rows must re-consent.
- Server logs a booleans-only shape line for each consent (`scopeGranted`, `sdkAddressPresent`, `platformAddressPresent`) so a failed attempt shows which side lacked the data. No tokens, UIDs or addresses are logged.
- UI/copy updated for the pending-address state and the new `PI_WALLET_SCOPE_NOT_GRANTED` error.

## Preserved protections
Explicit consent; no account-ID-as-address; no browser-supplied recipient; Testnet only; idempotency, lease fencing, single active request, uncertain-payment holds, independent receipt verification and ledger settlement checks.

## Operator steps
1. Review and apply the migration to Testnet only, as a single file (history is unreconciled; never `db push`). It requires `20261110125500` to be applied.
2. Deploy this source; confirm `wallet_address` is enabled for GreenHaven in the Pi Developer Portal.
3. Re-consent in Pi Browser, then watch the `[wallet-consent] pi proof shape` log line.
4. Run one small Testnet withdrawal and confirm the provider receipt.

## Open risk
If Pi's `/v2/me` does not report `wallet_address` in `credentials.scopes` even after the user allows it, consent fails closed with `PI_WALLET_SCOPE_NOT_GRANTED`; the log line will show that. This was not testable offline.

## Verification
`npm run verify:static` equivalent: all 314 steps pass on Node 22 (Run #302 gate extended to 31 assertions; wallet consent tests 15/15). Changed library files typecheck clean in isolation. Full Node 24.15.0 install/typecheck/lint/build, the migration on PostgreSQL, and a live Testnet payout remain outstanding.
