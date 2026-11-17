# Pi A2U — Testnet to Mainnet readiness (Run #302)

Sources: Pi Platform docs (Advanced Payments, Platform API, Developer Portal, Launching on Pi Mainnet) and the Pi community developer guide, read 2026-11-15. This is a source-level plan; it proves no payout and no approval.

## What Pi documents
- A2U is created by the app's **backend** with the Server API Key and the app-wallet seed: create, submit to the blockchain, complete. It never runs from the browser.
- Pi's A2U API exposes the user's wallet address only when the user has consented and the app has real intent to send Pi, and it returns the *current* wallet if the user changed it. The destination is therefore taken from `PaymentDTO.to_address`, not from a field the app collects.
- `/v2/me` returns `uid`, `credentials.scopes` (granted scopes) and `username`. It does not return a wallet address.
- A2U is available on Testnet; on Mainnet only for selected apps that apply for an **Outgoing Wallet** (separate from the Incoming Multisig Wallet used for U2A).
- Mainnet needs: a separate Mainnet Developer Portal project, a verified URL not used by another project, Pi KYC for the owner, a Mainnet-migrated wallet, the Mainnet API key (Testnet keys fail), and compliance with the Developer Terms.
- The Core Team criterion recorded in `PI_A2U_ECOSYSTEM_QUALIFICATION.md` (five completed Testnet A2U payments to five distinct KYC-passed Pioneers) is owner-supplied guidance; a third-party repository describes the same threshold. Treat it as evidence to collect, not a documented guarantee.
- Only one incomplete A2U payment can be open per app wallet at a time.

## Do users need a separate "claim" button?
No. The existing **Withdraw** action is the user-intent signal Pi's design asks for: the user selects an amount, consents once to wallet-address access, enters the withdrawal PIN, and the server then creates the A2U payment. A claim button would only duplicate that. Keep one entry point and make its states clear (authorize, pending, processing, paid).

## What GreenHaven already does (source)
Server-only API key and seed; Testnet fencing and kill switches; idempotent requests with leases; one active request per user; incomplete-payment recovery; independent `getPayment` receipt before settlement; admin qualification register that counts only provider-verified payments.

## Remaining for Testnet
1. Apply the Run #302 migration (single file, Testnet only, after `20261110125500`).
2. Confirm `wallet_address` is enabled for the app in the Developer Portal, API key and funded Testnet app wallet are set on the deployment, and the execution flags are on.
3. Five test Pioneers: each links Pi, re-authorizes once, holds withdrawable Testnet earnings, withdraws once. Record provider payment IDs and txids in the register.
4. Keep the Testnet app and the Mainnet app as separate projects with different URLs.

## Mainnet (not before Testnet evidence)
Create the Mainnet project, verify the URL, complete the wallet steps, apply for the Outgoing Wallet for A2U, switch to the Mainnet API key, and only then change network settings. Do not enable Mainnet execution without approval and funding.
