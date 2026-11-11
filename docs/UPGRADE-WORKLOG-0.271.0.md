# Upgrade worklog — 0.271.0

## Complete wallet authorization integration

### Problem
`WALLET_AUTHORIZATION_REQUIRED` correctly blocks payouts when `gh_pi_wallet_authorizations` has no active row. Linked Pi identity alone is insufficient.

### Application fix (security check preserved)
- Reusable `PiPayoutAuthorizationCard` (GET status, POST grant, DELETE revoke)
- Settings → Account & economy → **Pi payout authorization**
- Earnings/withdraw dashboard: seed auth from withdrawable snapshot, listen for `ghc:wallet-auth-changed`, clear Authorize CTA, emit events after grant
- Server assert path unchanged — consent still required

### Source verification
This release is source-level and source-only verification against the static contract suite and isolated helper tests. It does not claim live Supabase application or live Pi Testnet A2U settlement in this packaging environment.

Runtime limitation: full production proof still requires Node.js 24.15.0, applied migration `20261029010005_pi_identity_wallet_authorization.sql`, and Testnet credentials.

Supported runtime: Node.js 24.15.0.


Document date: 2026-11-01.
