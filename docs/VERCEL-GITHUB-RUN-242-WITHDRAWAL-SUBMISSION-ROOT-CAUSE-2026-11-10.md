# Run #242 — Pi withdrawal submission path repair

## Source and scope

Source: GreenHaven 0.338.19 Run #241 archive. This is an in-place Testnet-only reliability repair. No database migration, ledger mutation, payout execution flag, Pi network setting, or deployment setting is changed.

## Findings

The durable withdrawal POST route requires a PIN proof bound to the authenticated user and idempotency key before it can create/reserve a payout request. `PiWithdrawSheet` performs PIN verification and submits `pinProof`. The wallet dashboard also contained a separate `onRequestPayout` path that submitted directly to the same endpoint without `pinProof`. The `ghc:wallet-pi-focus` withdraw action could take that direct path whenever the dashboard believed wallet authorization was already active.

That bypass could produce `PIN_PROOF_REQUIRED`; it also violated the intended single withdrawal journey (amount → fresh quote → wallet consent state → PIN → request).

## Repair

- Removed the dashboard's direct payout POST handler and its associated idempotency state.
- Routed every dashboard withdraw-focus action through the existing `ghc:open-pi-withdraw` event.
- Kept `PiWithdrawSheet` as the only client submission path; it obtains the server PIN proof and sends it with the idempotency key.
- Added `scripts/check-phase-withdrawal-single-entrypoint.mjs` to prebuild checks.
- Incremented package version to 0.338.20.

## Important deployment gate

The server still intentionally rejects request creation unless all required Testnet controls are explicitly enabled: `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true`, `PI_NETWORK=testnet`, `PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=true`, `PI_A2U_ENABLED=true`, and `PI_A2U_TESTNET_ONLY=true`. This repair does not enable them. If any gate is absent, the route returns a safe 503 and does not reserve funds. Operator must verify the reviewed migration, funded Testnet executor, credentials, consent, settlement, cancellation and reconciliation readiness before enabling these flags. Never enable Mainnet or bypass the fail-closed gate to make the button appear to work.

## Evidence still required from the live attempt

The supplied Vercel log list showed successful GET requests and a successful cancellation POST, but did not include the detailed invocation for `POST /api/economy/earnings/withdrawals`. Therefore the precise live response code is not yet proven. After updating the Testnet preview, inspect that exact POST invocation. A 403 `PIN_PROOF_REQUIRED` would confirm the bypass symptom; a 503 `PI_EARNINGS_PAYOUT_REQUESTS_DISABLED` or `PI_EARNINGS_PAYOUT_EXECUTION_DISABLED` indicates the operator gates are off; 409 responses indicate a specific ledger/identity/authorization conflict.

## Validation

Run `node scripts/check-phase-withdrawal-single-entrypoint.mjs`, `node scripts/check-doc-hygiene.mjs`, TypeScript, and the full prebuild/CI suite on Node 24.15.0. A local static pass does not prove live Pi Testnet A2U execution.
