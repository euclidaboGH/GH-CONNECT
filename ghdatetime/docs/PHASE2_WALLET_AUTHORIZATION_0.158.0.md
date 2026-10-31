# Phase 2 — Pi identity wallet authorization (0.158.0)

## Goal
Establish a trustworthy link between the authenticated GreenHaven account, verified Pi app identity, and **explicit authorization** to receive App-to-User (A2U) payouts. Client-supplied recipients are never trusted.

## What shipped
1. Migration `20261029010005_pi_identity_wallet_authorization.sql`
   - `gh_pi_wallet_authorizations` (active / revoked / superseded)
   - `gh_pi_identity_link_events` audit log
   - RPCs: grant, revoke, get, assert_payout (service_role only)
2. Server module `lib/server/identity/wallet-authorization.ts`
3. API `GET|POST|DELETE /api/identity/wallet-authorization`
   - POST grants only to the **server-mapped** `pi_app_uid` for the session user
4. Cashback claim and seller A2U create **require** active authorization matching the recipient uid
5. `/api/identity/me` includes `walletAuthorization` snapshot

## Operator steps
1. Reconcile and apply `20261029010005_pi_identity_wallet_authorization.sql` on Testnet DB only after history check.
2. Users must open Identity / wallet authorization and grant consent before cashback withdraw.
3. Revoke removes active consent; subsequent A2U returns `WALLET_AUTHORIZATION_REQUIRED`.

## Not claimed
- Live Testnet receipt
- Automatic consent on every Pi login (consent is explicit)
- Mainnet A2U
