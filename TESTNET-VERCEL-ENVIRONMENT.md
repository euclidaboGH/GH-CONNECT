# GreenHaven Testnet Preview environment profile

This is the operator guide for `docs/TESTNET-PREVIEW-ENVIRONMENT.template`. The profile enables the supported Testnet feature surfaces without changing the canonical `.env.example`, whose disabled-by-default values are deliberately asserted by the repository's release/security checks.

## Deployment target

- Use a dedicated GitHub repository and a Vercel project connected to that repository.
- Configure this profile in **Vercel Preview** only. Do not copy it into Vercel Production.
- Keep `PI_NETWORK=testnet`, `NEXT_PUBLIC_PI_SANDBOX=true`, and `PI_ENV=production` together. `PI_ENV=production` selects the official Pi Platform API mode; it does not select Pi Mainnet.
- Set the actual Preview URL in `GHC_E2E_BASE_URL` and `GREENHAVEN_PREVIEW_URL` after the first Preview deployment.

## Enabled feature switches

The overlay enables the Testnet unlock, Pi purchase/payment surfaces, registration welcome bonus, activity rewards, referral settlement, tips, the legacy curation redistribution surface, Pi earnings payout requests, explicit A2U execution, GHC-to-Pi withdrawal intake, marketplace payout surface, Paystack transfer integration (test credentials only), and the Phase 4/5/42 Testnet E2E suites.

The overlay does not fabricate provider credentials, database keys, wallet seeds, operator keys, user sessions, payout rates, or test accounts. Those values must be provisioned separately as Vercel Preview secrets/configuration.

## Explicit safety holds — do not override by setting every flag to true

1. `PI_EARNINGS_AUTO_EXECUTE=false`: do not run unattended/background payouts. The operator-triggered Testnet executor remains available when fully configured and still enforces a real Testnet payout request, user wallet authorization, PIN proof, executor secret, Pi API key, valid Testnet wallet seed and database authority.
2. `GHC_CURATION_REDISTRIBUTE_V2_ENABLED=false`: the current V2 idempotency-safe wrapper is held until its review SQL is reconciled, applied and replay-tested. The legacy curation surface flag is enabled, but this does not bypass the V2 server gate.
3. `GH_GHPV_CALIBRATION_DAILY_CAP_V2_ENABLED=false`: automated GHPV settlement remains held until durable per-reviewer daily-cap SQL is applied and verified.
4. `GHC_ATOMIC_GLOBAL_EMISSION_V13_ENABLED` remains off: its allocator is a review-only SQL proposal and must not be activated before database reconciliation and rehearsal.
5. `GHC_WITHDRAWAL_GHC_PER_PI` is intentionally blank. Obtain and approve the exact Testnet conversion rate before GHC-to-Pi withdrawal requests can be accepted.
6. `PAYSTACK_SECRET_KEY` must be a Paystack **test** key (`sk_test_...`). `PAYSTACK_LIVE_TRANSFERS_APPROVED=false` is retained. Never use a live key in Preview.
7. E2E flags are on, but authenticated suites require disposable real Testnet accounts, session cookies and the deployed Preview URL. Tests that lack these inputs skip; they do not invent identities or payment state.

## Required Preview configuration

Set real values in Vercel Preview Environment Variables, never in Git:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` or `DATABASE_URL` where the deployment's DB tooling requires it
- `PI_API_KEY` or `PI_SERVER_API_KEY`
- `PI_WALLET_PRIVATE_SEED` (Pi Testnet wallet only; restrict access)
- `PI_EARNINGS_EXECUTOR_KEY` (random secret, at least 32 bytes)
- `GHC_A2U_ADMIN_KEY` / other operator keys only where the corresponding route requires them
- `GHC_PIN_PROOF_SECRET`, `GHC_BENEFICIARY_FINGERPRINT_KEY`, and required auth/security secrets
- `PAYSTACK_SECRET_KEY` beginning `sk_test_...` if testing Paystack bank-transfer test flows
- `GHC_E2E_BASE_URL`, `GHC_E2E_COOKIE_A`, and `GHC_E2E_COOKIE_B` for authenticated E2E; use disposable Testnet accounts only

Do not set `GHC_ALLOW_DEV_AUTH=true` on a deployed Preview environment as a substitute for real authentication. Do not commit populated `.env` files or paste secrets into issues, chat, build logs or test reports.

## Verification and known release blockers

Run the repository's static checks and supported-runtime checks under Node.js 24.15.x, then run the configured Playwright suites against the deployed Preview URL. A passing source/static check is not evidence that Supabase migrations are applied, Pi A2U is funded, Paystack test transfers are configured, or live authenticated E2E has passed.

The current source-of-truth worklog still records unresolved Testnet migration-history discrepancies, held SQL proposals, outstanding provider/device acceptance and an unapproved release status. Do not bulk-push migrations or claim Testnet certification until those items are reconciled and verified. Mainnet remains out of scope.
