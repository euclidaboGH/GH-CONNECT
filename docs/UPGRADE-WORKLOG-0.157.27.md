# GreenHaven v0.157.27 upgrade worklog

## Objective

Add a safe user-facing Pi cashback A2U path so eligible finalized cashback can be paid to the verified linked Pi Testnet identity without reusing seller payout records or trusting client-provided amounts/recipients.

## Source changes

- Added `supabase/migrations/20261029010004_pi_cashback_testnet_a2u_payouts.sql` with a distinct entitlement-bound payout ledger, unique entitlement/provider-payment/txid constraints, RLS and service-role-only RPCs.
- The cashback payout reservation shares `gh_pi_a2u_sequence_lease` with seller A2U, preventing simultaneous app-wallet sequence submissions.
- Added `POST /api/economy/rewards/pi-cashback/claim`. It authenticates the account, derives the recipient from `gh_pi_identities`, derives the amount from a finalized server-side entitlement, and remains hard-gated to explicit Pi Testnet configuration.
- Provider checks bind payment ID, A2U direction, Pi Testnet network, payout request metadata, recipient UID, exact seven-decimal amount, verified transaction ID and developer completion. The payout is marked paid only through a service-role reconciliation RPC after these checks.
- Retry after ambiguous SDK/network outcomes reuses the durable payout request and provider payment ID; unrelated incomplete A2U payments stop for review rather than starting another sequence payment.
- Rewards Center cashback UI shows the withdrawal action only when server flags and credentials are configured and a positive available calculated balance exists. Processing/paid payouts reduce the displayed available amount and their state appears in statement rows.
- Added `scripts/check-pi-cashback-a2u.mjs` and registered it in prebuild and static verification. Updated roadmap, release version and migration inventory.

## Important limitations

- New migration is `REVIEW_REQUIRED`; it has not been applied to any Supabase project. It depends on the existing cashback ledger and global A2U sequence-lease migration being present with matching signatures.
- Real wallet credits require a funded Pi Testnet app wallet, correct Testnet API key/private seed, `PI_A2U_ENABLED=true`, `PI_A2U_TESTNET_ONLY=true`, `NEXT_PUBLIC_PI_SANDBOX=true`, and `PI_ENV=production` for the official SDK bundle. Never configure these as a shortcut on Mainnet.
- Only finalized positive cashback entitlements are eligible. The code does not create fake/test cashback balances. If no eligible entitlement exists, the endpoint returns `NO_WITHDRAWABLE_CASHBACK`.
- Remaining revenue sources (membership, promotions, digital services, creator tips and linked refunds/chargebacks) still require separate source audit/wiring before cashback can be considered complete for all GreenHaven spend.
- The code does not authorize Mainnet A2U. Mainnet permission and outgoing-wallet authorization must be confirmed with Pi before a separate reviewed release.

## Verification boundaries

Static contracts can validate source-level gates but cannot prove SQL execution, SDK compatibility, real wallet credit, or production readiness. The environment's Node.js version is below the project's required Node.js 24.15.0 baseline and dependencies are not installed. TypeScript, lint, Next.js production build, disposable PostgreSQL, remote migration history, funded Testnet transfer, failure/retry recovery, and browser journeys remain outstanding. No remote database or Vercel setting was changed.
