# Phase 20 — Pi A2U SDK and seller payout settlement

## Delivered in source

- Added the official `pi-backend` Node.js SDK as a project dependency. The SDK performs Platform API payment creation/completion and Stellar/Horizon transaction construction/signing/submission; GreenHaven does not implement private-seed signing itself.
- Replaced the disabled A2U create stub with a privileged, Testnet-only execution workflow: durable payout lookup, verified Pi UID lookup, globally leased sequence lane, incomplete-payment recovery, provider payment binding checks, SDK submit/complete, provider evidence hash, durable reconciliation, and payout transition to paid only after verification.
- Added a durable A2U execution table and expiring global sequence lease. This is necessary because the Pi developer guidance notes A2U payment sequence-number constraints and recommends one payment at a time.
- Added a privileged payout lifecycle operator endpoint for review/approval/processing/rejection; it explicitly cannot set `paid`.
- Added a separate atomic GHC seller payout path. It verifies the completed/verified order allocations, locks treasury and seller balances in canonical order, checks actual spendable treasury funds, posts both ledger legs, writes settlement evidence and marks the payout paid in the same SQL transaction.
- GHC seller payouts stay disabled by default. They require a reviewed, funded treasury account and explicit server-side feature gate.
- Bank payouts remain disabled because the repository has no selected/contracted bank provider, verified beneficiary onboarding, provider credentials, or webhook/reconciliation configuration. Do not mark bank payouts paid by operator-entered references.

## Required server-side environment

- `PI_API_KEY` or `PI_SERVER_API_KEY`: Pi Developer Portal server API key; secret only.
- `PI_WALLET_PRIVATE_SEED`: app wallet seed; secret manager only, never commit or expose in client variables.
- `PI_ENV=production`: loads the official SDK's packaged configuration bundle; this setting does not enable Pi Mainnet payouts.
- `PI_A2U_ENABLED=true`, `PI_A2U_TESTNET_ONLY=true`, `NEXT_PUBLIC_PI_SANDBOX=true`: required together to attempt Testnet A2U. Keep off until Testnet validation succeeds.
- `GHC_A2U_ADMIN_KEY`: privileged A2U endpoint key.
- `GHC_PAYOUT_RECONCILIATION_KEY`: privileged payout settlement key.
- `GHC_MARKETPLACE_GHC_PAYOUTS_ENABLED=true` and `GHC_MARKETPLACE_PAYOUT_TREASURY_USER_ID`: only after the treasury identity, reserve balance, limits and governance are reviewed.

## Operational constraints

1. A2U uses only `Pi Testnet`; the route refuses a Mainnet runtime. Never enable A2U by setting the sandbox flag false.
2. An unrelated incomplete SDK server payment blocks new creation until an operator reconciles it. Do not cancel it automatically.
3. Ambiguous SDK/network failures preserve durable execution state. Retries must resume from provider payment ID / txid or the provider's incomplete-payment list; never create a second payment for the same payout.
4. A2U provider completion is not enough on its own: recipient UID, amount, direction, network, request metadata, txid and verification flags must match before seller payout status becomes paid.
5. GHC payout settlement is internal-ledger movement, not Pi or bank transfer. It debits a configured funded treasury and credits the seller atomically.
6. Migration files are source artifacts only. They have not been applied to Supabase. Review target history, then run disposable PostgreSQL and Testnet tests before any apply.
7. The package-lock dependency graph must be refreshed with a registry-connected supported Node/npm environment before CI or production build. The current workspace had DNS/network failures reaching registry.npmjs.org, so a complete dependency install and `npm ci` could not be verified here.

## Test plan before enabling

- `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, `npm run build` on Node 22.22.2+ or 24.15.0+.
- Apply migrations 006 and 007 to a disposable database after checking dependencies; run two concurrent calls for the same Pi payout and verify one provider payment ID and one txid.
- Inject failures after provider creation, after chain submission, after provider completion, after reconciliation record, and before payout status update; verify retries never create duplicate payouts and converge safely.
- Verify unrelated incomplete A2U payment blocks creation.
- Verify wrong UID, amount, metadata, direction, network, txid and unverified transaction cannot mark payout paid.
- For GHC, test insufficient treasury, invalid order allocation, restricted seller/treasury, duplicate settlement, concurrent calls and post-ledger retries; exactly one debit/credit pair must exist.
- Only after evidence is reviewed should Testnet flags be enabled. Do not use Mainnet for initial verification.

## Dependency-lock refresh blocker

The workspace could not reach `registry.npmjs.org` (`EAI_AGAIN`), so the official `pi-backend` package's full transitive lock graph could not be generated here. Before pushing, use a registry-connected Node 24.15+ environment to run:

```bash
npm install --package-lock-only --legacy-peer-deps
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run build
```

Review and commit the resulting `package-lock.json` changes. Do not bypass or delete the lockfile. This step is required because the new SDK dependency was added to `package.json`, while the workspace could not resolve the full package graph offline.


## Phase 23 documentation correction

The official Pi Core Team repository `https://github.com/pi-apps/pi-nodejs` publishes the npm package `pi-backend@0.1.3` and identifies Pi Core Team authorship. The adapter code is retained. Its package graph still must be generated by npm in a registry-connected environment; do not hand-write package integrity values. A2U remains Testnet-only and disabled pending clean install, Testnet E2E, and operational evidence.
