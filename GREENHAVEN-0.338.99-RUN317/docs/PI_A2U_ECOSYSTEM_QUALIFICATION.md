# Pi A2U Ecosystem Qualification — Run 261

**Release:** GreenHaven 0.338.27 · **Network:** Pi Testnet only · **Status:** source implementation; migration not applied; no qualification transactions asserted.

## Objective

Provide an auditable register for the five A2U transaction criterion communicated to GreenHaven by the Pi Core Team. The register requires five successfully completed Pi Testnet App-to-User payments to five distinct Pioneers whose **fully passed KYC** status has been independently checked by an authorized operator.

This five-transaction criterion is recorded as the Core Team guidance supplied by the app owner; the public Mainnet listing page separately documents Mainnet outgoing-wallet approval and does not, by itself, establish that every listing review uses this exact five-transaction threshold.

## What counts

A transaction is counted only after the server independently retrieves the provider payment by its existing payment ID and verifies all of the following:

- `direction = app_to_user`
- `network = Pi Testnet`
- `user_uid` matches the attested Pioneer Pi app-specific UID
- amount is positive and valid
- provider transaction ID equals the operator-supplied txid
- Pi reports transaction verification (`transaction_verified` or `transaction.verified`)
- Pi reports `developer_completed = true`
- payment is not cancelled or user-cancelled
- provider `to_address` exactly matches the same Pioneer's active, server-verified GreenHaven Pi wallet authorization address
- GreenHaven A2U metadata contains `direction=a2u` and a non-empty `payoutRequestId`
- the recipient has a prior `fully_passed` KYC attestation
- provider payment ID, txid and recipient UID have not already been counted

The provider destination is cross-checked against the wallet address bound to that same Pi UID. The database stores the verified destination alongside the receipt. The database enforces one qualification transaction per recipient UID, so the target represents five distinct Pioneers, not five payments to one Pioneer.

## KYC evidence boundary

The app's Pi authentication/Platform API integration does not provide a verified full-KYC status field that this implementation can safely consume. An authorized GreenHaven operator must inspect the official Pi KYC app and attest that the Pioneer shows **KYC passed / fully approved**. Tentative approval, pending review, and unverified self-assertions do not qualify.

Only a non-sensitive internal evidence reference is stored. Do not upload ID documents, KYC screenshots, names, phone numbers, or other identity documents into GreenHaven's qualification register.

## Operations

1. Deploy the matching source release to the Testnet Preview environment.
2. Review and apply `20261110210001_pi_a2u_ecosystem_qualification.sql` to **Testnet only**, after comparing the live migration history. It is classified `REVIEW_REQUIRED`; do not apply automatically or to Mainnet.
3. Confirm the Testnet A2U API key, app-wallet seed, outgoing-wallet funding and existing A2U execution gates. This register does not fund or create payments.
4. Open `/admin/a2u-qualification` as an authenticated operator with `GHC_A2U_ADMIN_KEY` and the operator identifier.
5. Attest each Pioneer only after verifying fully passed KYC in the official Pi KYC app and verifying that their GreenHaven Pi UID mapping is correct.
6. Execute genuine A2U payments through GreenHaven's existing A2U workflows. The register's payment action is read-only: it calls `getPayment` and records evidence only after provider verification.
7. Record the provider payment ID, txid and recipient UID. Confirm five distinct recipients and five independently verified settlements.
8. Preserve provider IDs, txids, timestamps, operator identifiers and the Pi Developer Portal evidence for the Core Team review.

## Safety boundaries

- No A2U payment is created, submitted, completed, cancelled, or retried by the qualification register.
- No failed, uncertain, pending, cancelled, unverified or duplicate payment counts.
- The register does not mark any GreenHaven wallet balance or payout request as paid.
- Mainnet A2U remains disabled until the Pi Core Team approves the outgoing wallet and Mainnet environment controls are separately reviewed. Pi documentation states A2U is available for Testnet apps and selected Mainnet apps and requires an Outgoing Wallet application for Mainnet A2U.
- Five recorded transactions are evidence toward the stated criterion, not a guarantee of ecosystem listing approval.

## Verification status

Source checks validate the operator gate, identity binding, KYC attestation boundary, provider receipt checks, duplicate prevention, RLS and service-role-only RPC grants. Database execution, Testnet deployment, live provider payment inspection and the five actual A2U transactions remain operator/deployment steps.
