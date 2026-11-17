# Pi A2U requirements and GreenHaven next steps (research note, 2026-11-15)

Sources read: Pi Platform docs (`payments_advanced`, `SDK_reference`, `developer_portal`), Pi SDK docs (Launch, Platform API), Pi Community Developer Guide (Mainnet Listing Requirements), and community integrations that report observed Developer Portal behaviour. Items marked *community-reported* are not stated in Pi's published docs; confirm them in the Developer Portal.

## What Pi documents
- A2U (App-to-User) is server-initiated through a backend SDK (`pi-backend`), never the browser SDK. It is documented as available on Testnet and selected Mainnet apps.
- Pi's A2U API returns the user's current wallet only when the user has consented and the app intends to pay. Wallet access is deliberately tied to the intent to send Pi.
- Client scopes are `username`, `payments`, `wallet_address`. `/v2/me` returns `uid`, `credentials.scopes` (granted scopes) and `username` if granted; it does not return the wallet address.
- Mainnet launch: new Mainnet app, URL verification, Incoming Multisig Wallet application for U2A, and an Outgoing Wallet application if the app needs A2U.
- Mainnet listing criteria: fully functional professional UI, developer KYC, no Pi trademark misuse (domain must not start with "pi"), Pi authentication only, Pi-only transactions, no external redirects, minimal data collection.

## Community-reported (verify in the portal)
- The portal asks for A2U payments from the paired Testnet app to 5 unique wallets before granting a Mainnet app wallet. GreenHaven's register (`PI_A2U_ECOSYSTEM_QUALIFICATION.md`) already tracks five distinct, provider-verified Testnet A2U payments.
- Creating an A2U payment for a user who has not granted `wallet_address` fails with a 401 `missing_scope`; retrying does not help.

## Is a "claim" button needed?
Pi does not require one. The existing Withdraw flow is the user-intent action Pi's design expects: the wallet permission is requested when the user chooses to withdraw. A separate one-time "claim 0.01 Test-Pi" onboarding button is optional product work for collecting the five qualifying wallets faster; it must still use the same consent gate, ledger and worker, and a separate funding source decision.

## Remaining operator work
1. Apply the Run #302 migration (Testnet, single file) so scope-only consent can be stored.
2. Re-consent, then run one small Testnet withdrawal end to end and keep the provider receipt.
3. Repeat for five distinct Pioneers with fully passed KYC (per the Core Team guidance recorded in the qualification doc).
4. Submit the Mainnet app and Outgoing Wallet applications in the Developer Portal when the Testnet evidence exists; keep Mainnet A2U disabled until approved.
5. Review listing criteria above (domain, authentication, external links, data collection).
