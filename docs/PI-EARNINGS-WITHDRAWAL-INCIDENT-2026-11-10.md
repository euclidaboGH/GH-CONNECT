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
