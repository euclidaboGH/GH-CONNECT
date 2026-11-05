# Pi Wallet Authorization and Withdrawal Hardening — 2026-11-04

## Source

Based on `GREENHAVEN-0.313.1-FINAL-POLISH-2026-11-04.zip`.

## Confirmed account state from the supplied Preview responses

The account is authenticated and has a mapped Pi app UID, but explicit payout consent has not been recorded (`consentedAt`, `authorizationId`, and `authorizedPiAppUid` are null; `authorizationActive` is false). The payout gate correctly rejects this state with `WALLET_AUTHORIZATION_REQUIRED`.

The supplied database catalog query confirms the authorization RPC functions exist, are `SECURITY DEFINER`, and are executable by `service_role`. This does not prove that the deployed Preview function can reach the intended Supabase project, use the correct service-role credential, or complete the grant transaction.

## Changes

1. `lib/server/identity/wallet-authorization.ts` now records safe server-side diagnostics for missing privileged Supabase configuration, PostgREST HTTP failures, invalid JSON, and transport/time-out failures. It does not log credentials, authorization headers, raw PostgREST messages, or identity values.
2. `components/ghc/pi-payout-authorization-card.tsx` and `components/ghc/unified-earnings-dashboard.tsx` surface safe HTTP status/error codes so a user on mobile can report the failure without browser DevTools.
3. The main wallet flow now performs a fresh GET after the consent POST and requires both `authorizationActive === true` and `uidMatchesAuthorization === true` before unlocking withdrawal.
4. `app/api/economy/earnings/withdrawals/route.ts` independently checks active consent against the server-quoted Pi recipient before reserving a payout request. The execution worker keeps its separate check immediately before A2U.
5. `components/ghc/unified-earnings-dashboard.tsx` now reuses the same idempotency key for retries of an uncertain request with the same amount, and clears it only after a confirmed request response.
6. Repaired stale source/release metadata and static regression checks, including current release references, the client directive placement in Rewards Centre, and brittle assertions that no longer matched the actual implementation.
7. Regenerated the repository-only migration inventory. It now correctly includes 178 SQL migrations: 116 REQUIRED, 59 REVIEW_REQUIRED, 1 REQUIRES_APPROVAL, and 2 PROPOSAL. The latest community membership-view migration remains held as REVIEW_REQUIRED; no migration was applied.

## Verification

- `npm run verify:static`: **passed**, including the network/database-independent 57/57 static gate and the additional registered regression suites.
- `node scripts/check-phase2-wallet-authorization.mjs`: **18/18 passed**.
- `node scripts/generate-migration-inventory.mjs --check`: **passed**, all generated inventory artifacts synchronized.
- TypeScript, lint, and production build: **not run**. This environment provides Node.js 22.16.0, but the project pins Node.js 24.15.0; the locked dependency installation did not complete before timeout.
- Live Vercel Preview / Supabase integration: **not run**. No live deployment credentials or write access were provided.
- Database migrations: **none applied**.
- Payout request/execution flags and Mainnet: **not enabled or changed**.
- No payout transfer or financial record mutation was attempted.

## Required live acceptance

1. Deploy the source changes to the existing Preview deployment using the repository's supported Node 24 runtime.
2. Have the account owner tap **Authorize Pi wallet for payouts** once.
3. Confirm the POST succeeds and a fresh GET reports `authorizationActive: true` and `uidMatchesAuthorization: true`.
4. Confirm the withdrawal request endpoint accepts only the server-quoted recipient and rejects missing/revoked/mismatched consent.
5. Exercise idempotent request retries, then the operator-only funded Pi Testnet execution/receipt/recovery drill with execution disabled until all preceding gates pass.

Do not enable Mainnet or payout execution while authorization and funded Testnet acceptance remain incomplete.


## Phase 2 completion update — 2026-11-05

The latest uploaded 0.313.1 source is the baseline. The Phase 2 source completion now includes:

1. `202611050001_pi_wallet_authorization_explicit_consent_only.sql`: additive replacement of the grant RPC. It accepts only `user_explicit`, validates the current durable `gh_pi_identities` mapping, serializes concurrent grants by user and Pi UID, supersedes stale active grants, writes the consent audit event, and retains service-role-only execution.
2. The authorization POST independently reads the grant back and returns success only when the active authorization matches the same Pi UID resolved from the server-side identity mapping.
3. The server authorization store treats `authorizationActive` as true only when `uidMatchesAuthorization` is also true.
4. The withdrawable endpoint exposes the UID-match result and derives its active flag from both conditions.
5. The earnings dashboard and standalone authorization card require active consent plus a matching UID; POST success alone never unlocks withdrawal.
6. The RPC wrapper retains sanitized diagnostic codes and HTTP status for the API response while never returning raw PostgREST bodies, credentials, or authorization headers.

### Operational boundary

This is source-level Phase 2 completion, not proof that the new migration has been applied to the Preview Supabase project or that the live user has granted consent. Apply the additive migration to the Preview/Testnet database after confirming the migration history. Then deploy the source to the Preview branch and have each user explicitly authorize their own Pi wallet. Confirm POST success and GET fields `authorizationActive: true` and `uidMatchesAuthorization: true`.

No authorization records are inserted by this migration. It does not enable payout execution, change Mainnet configuration, create withdrawals, or send Pi.
