# Upgrade worklog — 0.271.1

## Root cause (database + application)

- Tables `gh_pi_wallet_authorizations` and `gh_pi_identity_link_events` exist with RLS deny-all and service_role-only RPCs.
- Both tables returned **zero rows** → users never completed explicit consent grant.
- Payout guard correctly returns WALLET_AUTHORIZATION_REQUIRED.
- Pass49-era UI guided users to Identity without a working POST grant action.
- `gh_pi_wallet_authorization_get` hasMapping used FOUND after the authorization SELECT (bug). Live DB was corrected; source migration aligned + idempotent follow-up `20261101090001`.

## Application fix (guard preserved)

- `PiPayoutAuthorizationCard` + Settings → Pi payout authorization
- Earnings dashboard Authorize CTA → POST `/api/identity/wallet-authorization` (server mapping only)
- No optimistic active flag until refresh confirms
- Assert on withdraw execute / cashback claim / A2U create unchanged

## Pi A2U note

Official Platform API: A2U is server-initiated (`POST /payments` with Server API Key, recipient `uid`). GH-CONNECT consent is application-level authorization that the app may request A2U to the **verified mapped** Pi UID — not a replacement for Pi Server API Key or funded app wallet.

## Source verification

This release is source-level and source-only verification (static contracts / isolated helper tests). It does not claim live two-user Testnet settlement in this packaging environment.

Supported runtime: Node.js 24.15.0.


Document date: 2026-11-01.
