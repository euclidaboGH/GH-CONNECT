# Operator guide — Pi payout authorization & A2U (Testnet first)

## Concepts (do not conflate)

| Concept | What it is | Who owns it |
|---------|------------|-------------|
| Pi identity link | Verified mapping of GH user ↔ Pi app `uid` from `GET /v2/me` | Pi Platform + GH identity tables |
| Payout authorization | GH-side explicit consent that A2U may target that mapped uid | `gh_pi_wallet_authorizations` |
| A2U execution | Server creates payment with **Server API Key**, submits chain tx with wallet seed, completes via Platform API | Pi Platform + app wallet + GH worker |
| Ledger "paid" | Only after verified completion / reconciliation — never on client 200 or payment-created alone | `gh_earnings_*` / payout state machine |

Official Pi Platform docs: A2U is **server-initiated** (`POST /v2/payments` with Server API Key + recipient `uid`). A2U historically **Testnet-oriented** in Advanced Payments docs; Mainnet requires separate operator readiness.

## Required migration

Apply (if not already applied on the target project):

`supabase/migrations/20261029010005_pi_identity_wallet_authorization.sql`

This creates:

- `gh_pi_wallet_authorizations` (active/revoked/superseded, unique active per user and per uid)
- `gh_pi_identity_link_events` audit
- Service-role RPCs: get / grant / revoke / assert_payout
- **Deny-all RLS** for clients

Verify after apply:

```sql
select status, count(*) from public.gh_pi_wallet_authorizations group by 1;
select proname from pg_proc where proname like 'gh_pi_wallet_authorization%';
```

## Vercel / env (Testnet)

- `NEXT_PUBLIC_PI_SANDBOX=true` for Testnet app
- `PI_API_KEY` / server key — **never** `NEXT_PUBLIC_*`
- App wallet private seed — server-only secret (never log)
- `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED=true` only after migration + funded Testnet app wallet + worker path verified
- Keep Mainnet credentials and flags isolated; never point Testnet UI at Mainnet keys

## User path after deploy

1. Sign in with Pi (identity mapping exists).
2. Rewards / Wallet earnings: **Authorize Pi wallet for payouts**.
3. Preview 3% fee → **Withdraw to Pi wallet** (creates durable request; does not invent paid).
4. Operator worker executes A2U; user sees ledger status from server only.

## Rollback

- Disable `PI_EARNINGS_PAYOUT_REQUESTS_ENABLED` to stop new requests.
- Do not drop authorization tables while historical payouts reference them.
- Revocation blocks **future** requests; it does not reverse completed chain payments.

Document date: 2026-11-01 · relates to release 0.266.x / 0.270.x payout authorization UX.
