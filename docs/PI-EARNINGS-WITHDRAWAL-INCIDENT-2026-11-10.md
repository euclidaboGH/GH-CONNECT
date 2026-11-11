# Pi earnings withdrawal incident and recovery plan — 2026-11-10

## Evidence from the user's wallet snapshot and Testnet

- The wallet displays 2.00 π available and 1.00 π reserved against request `534bb470-5702-49da-a5e2-47bfce7aac13`. The reserved 1.00 π is not available for a second spend while the request is unresolved.
- The live Testnet row for that request is `uncertain`, has one execution attempt, no persisted Pi provider payment ID, no txid, no verified receipt and no active execution lease. The request must not be settled or released based on a timeout or missing provider ID alone.
- The source worker acquires the global A2U sequence lease, then calls the official `pi-backend` `getIncompleteServerPayments()` before creating a new payment. If an unrelated incomplete A2U payment exists, it refuses to create another transfer. This is consistent with Pi's documented one-incomplete-server-payment constraint.
- Before Run #256, the earnings worker did not enqueue this blocker into the shared `gh_pi_a2u_review_queue`, unlike the seller and cashback A2U workers. Its finalizer also overwrote specific failure context with a generic code. This made the shared A2U blocker difficult for operators to identify and left the user with a generic pending message.

## Run #256 source correction

1. The earnings worker now enqueues unrelated incomplete A2U blockers to the existing service-role-only review queue, preserving provider payment ID, txid and bounded domain/request metadata.
2. The operator treasury summary performs a read-only Testnet `getIncompleteServerPayments()` inspection when exact Testnet flags and server credentials are present. It exposes no Pi UID, access token, API key or wallet seed.
3. The worker persists a sanitized diagnostic failure code and no longer returns raw provider exception messages to the browser.
4. The wallet explains that an unrelated incomplete Pi app-wallet payment must be reconciled before another transfer can begin.
5. No unrelated provider payment is cancelled, submitted or completed automatically. No reservation is force-released.

## Pi identity and recipient semantics

Pi's official A2U backend SDK creates a payment using the authenticated app-specific Pi UID (`uid`). GreenHaven derives this UID from its verified Pi identity mapping and checks active explicit payout consent. A user-supplied address is not accepted as a recipient override. Pi's official documentation describes A2U as a Testnet feature and requires the backend to create, submit, and complete the payment with verified provider evidence. GreenHaven must not advertise Mainnet A2U until Pi grants the required outgoing-wallet approval and a separate Mainnet release review passes.

## Required operator recovery for request 534bb470

1. Connect Vercel and inspect the Preview deployment's exact `POST /api/economy/earnings/withdrawals/process` invocation and the new operator treasury `exceptions.piProviderIncomplete` read-only diagnostic.
2. Identify the incomplete provider payment by its metadata (`domain`, `payoutKind`, `payoutRequestId`) and txid/status. Do not disclose the recipient UID in tickets or chat.
3. Route the payment to its owning domain: Pi earnings, seller marketplace, cashback, creator or other. Reconcile it using that domain's durable request row and exact amount/recipient/network binding.
4. If a transaction exists, verify the txid and provider status and complete the original payment; then settle only the corresponding source ledger. If no transaction exists, cancel only after proving the payment is the exact owned request and the Pi provider confirms no transaction.
5. Reconcile the uncertain earnings request separately. Because it has no provider payment ID, do not mark it paid or release its reservation until the provider lookup and worker audit prove whether a payment was created before the ID could be persisted.
6. Run a small, approved Testnet withdrawal with a non-production account and verify provider payment ID, recipient UID, amount, network, txid, transaction verification, developer completion, ledger settlement and duplicate retry behavior.

## Operator flags (Preview/Testnet only)

The code compares these values as exact strings. Do not use `1`, `yes`, quoted values or whitespace:

```dotenv
PI_NETWORK=testnet
PI_ENV=production
NEXT_PUBLIC_PI_SANDBOX=true
PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true
PI_EARNINGS_PAYOUT_EXECUTION_ENABLED=true
PI_A2U_ENABLED=true
PI_A2U_TESTNET_ONLY=true
PI_EARNINGS_AUTO_EXECUTE=true
```

Server-only secrets required by the worker: `PI_API_KEY`, `PI_WALLET_PRIVATE_SEED`, `PI_EARNINGS_EXECUTOR_KEY` (or the approved `GHC_A2U_ADMIN_KEY` fallback), `GH_PIN_PROOF_SECRET`, and Supabase service-role configuration. Never put any of these in `NEXT_PUBLIC_*`, browser code, Git, or a user-visible log. Confirm the outgoing Testnet app wallet is funded. The health endpoint checks configuration presence/format, not wallet funding or payment success.

## Release decision

Run #256–257 source checks pass, but the actual Pi provider incomplete payment has not yet been inspected because the Vercel deployment connector is not connected in this session. No Pi transfer or balance mutation was made. Testnet withdrawal acceptance remains OPEN; Mainnet A2U remains disabled; production is NOT APPROVED.


## Run #260 — 13:42 local live incident and wallet-address audit

### Confirmed live state

- Vercel Preview deployment `dpl_HMcWzp1ma76wqdJMdGrgNpq5JcWs` is READY on commit `237070b2817680933b82994ca72737bd1e90d505` (source package 0.338.25, Node 24.x). Request `8b4d2-1794314546230-14f9648ea998` to `/api/economy/earnings/withdrawals/process` returned HTTP 503. The only provider log was `PI_PROVIDER_OUTCOME_UNCERTAIN`; there was no stage, provider HTTP status or provider error code. The old log is insufficient to distinguish SDK initialization, incomplete-payment lookup, create, bind, submit, complete or receipt lookup failure.
- Testnet has three requests: `534bb470-5702-49da-a5e2-47bfce7aac13`, `411b2152-b47d-4fae-a9e3-818a71e82a51`, and `300baa48-2b04-4a62-b2d1-b0b4c97dc799`. Each is 1.00 π gross, 0.03 π fee, 0.97 π net, status `uncertain`, no persisted provider payment ID, no txid and no verified receipt. The 3.00 π total remains reserved.
- The Testnet identity row is verified and the active payout authorization maps to the same Pi app UID. Its username is `EUCLIDABO`. The authorization table currently stores no Pi/Stellar wallet address. Therefore the old screen's “linked at sign-in” is not a verified blockchain wallet-address display.

### Recipient and wallet model

- The existing A2U worker sends to the Pi app-specific UID returned by server-verified `/v2/me`; it does not set a raw Stellar public address as the A2U recipient. A2U therefore relies on Pi Network's account-to-wallet mapping.
- Run #260 requests the official Pi SDK `wallet_address` scope only during explicit payout consent, reads the wallet address from the official Pi SDK `wallet_address` scope, validates its public-key format, and persists it with the same server-verified Pi UID. If `/v2/me` also returns the address, the values must match; otherwise it is marked SDK-reported until the provider PaymentDTO `to_address` confirms it before submission. The Wallet screen masks the address by default, offers a copy action, labels its source (`Pi SDK`, `Pi API`, or `Provider-confirmed`), and explains that the A2U recipient remains the UID. A provider destination mismatch blocks submission and requires operator review. No arbitrary user-entered destination is accepted, and no wallet secret/private seed is ever exposed.
- Legacy UID-only authorizations will no longer satisfy the new payout assertion after the Run #260 migration. Users must re-consent through Pi Browser with the wallet-address permission before a new payout can be created.

### Surgical source changes in 0.338.26 / Run #260

1. Replaced the opaque SDK `getIncompleteServerPayments()` call with a bounded direct Pi Platform read-only adapter that preserves safe HTTP/provider error codes. The pinned SDK catches all incomplete-lookup errors and throws generic `unknown_error`, which hid the true failure stage.
2. Added per-stage diagnostics (`SDK_INITIALIZATION`, `INCOMPLETE_LOOKUP`, `CREATE_PAYMENT`, `BIND_PROVIDER_PAYMENT`, `GET_PAYMENT`, `SUBMIT_PAYMENT`, `COMPLETE_PAYMENT`, `VERIFY_RECEIPT`, `SETTLE_LEDGER`) and safe provider status/code logging; raw provider messages remain hidden.
3. Added read-only incomplete-A2U lane status to `/api/health/withdrawals` and operator Treasury inspection. The health response exposes only lane status, not payment identifiers or recipient details.
4. Added a database guard allowing at most one `reserved`, `processing` or `uncertain` Pi payout request per user. Existing requests remain unchanged; retries with the original idempotency key still resolve to the same request. A prior ambiguous attempt without a provider ID can only recover an exact matching incomplete payment; if no match exists, no replacement payment is created.
5. Added Pi `wallet_address` scope binding, durable address/source metadata, provider `to_address` comparison, and masked Wallet display/copy action.
6. Added a per-request “Reconcile this Pi payout” action for uncertain reservations. It can resume only the exact matching provider payment; if Pi has no exact incomplete match, it creates no replacement and leaves the reservation intact.
7. Updated the withdrawal sheet to show safe provider diagnostics and warn users not to create another request while an earlier request is unresolved.

### Migration and release gates

Migration `20261110125500_pi_wallet_address_binding_and_verified_a2u_diagnostics.sql` is REVIEW_REQUIRED and unapplied. It adds the Pi-reported public wallet address and its source, retires the old UID-only grant function, requires a bound address, snapshots it on each payout request, checks provider `to_address` before submission and settlement, and adds the single-active-request guard. Apply only to Testnet after the 0.338.26 source is deployed and the target migration history is reconciled. Do not touch Mainnet.

The three existing uncertain requests must be reconciled against Pi's authoritative provider state before settlement or release. A missing provider ID is not proof that no provider payment was created. If Pi returns a matching incomplete payment, resume only that exact payment after validating request ID, UID, amount, network and metadata. If no matching incomplete payment exists, the worker now refuses to create a replacement and escalates to provider-side transaction/history reconciliation; do not release the reservation based solely on that absence.

Run #260 static/runtime source contracts and migration lexical checks must pass; the source has not yet been pushed/deployed and the migration has not been applied. A real small-value Testnet payout, provider receipt, app-wallet funding check, two-account wallet binding, Node 24.15.0 typecheck/lint/build, browser/device acceptance and Mainnet review remain separate gates. Production remains NOT APPROVED.


## Run #291 — 2026-11-11 connected Testnet postflight and recovery safety correction

A read-only aggregate query against GH Connect Testnet confirms 3 Pi Testnet earnings requests remain `uncertain`, totalling 30,000,000 atomic units (3.00 π gross). None has a persisted provider payment ID, txid or active execution lease. Ten prior requests are `released`, totalling 130,000,000 atomic units (13.00 π gross). No payout, reservation, ledger entry or balance was changed during this audit. The three uncertain requests remain protected: the absence of a persisted provider ID is not evidence that Pi did not create a payment. Do not retry or release them until Pi's authoritative provider state is reconciled.

Review of source migration `20261111120001_pi_earnings_release_stale_incomplete.sql` found that its original stale-`processing` branch treated an old `execution_started_at` timestamp as sufficient evidence to release a reservation. That is unsafe: a provider call may have created a Pi payment before the worker persisted its payment ID or lost its lease. Run #291 changes the migration so the user-facing RPC can release only `reserved` requests with no provider payment ID, txid, receipt or verification, no execution start, no lease token/expiry, and zero execution attempts. `processing` and `uncertain` remain held for provider reconciliation. The release also clears both lease fields and continues to use the atomic `gh_earnings_release_reserve` ledger function.

The migration is now `REVIEW_REQUIRED` and unapplied. Its 15-check source regression test passes. Testnet migration history and exact source order must be reconciled before applying it. Mainnet remains inactive and untouched.
