# Phase 6 — Accurate available balances (0.163.0)

## Goal
Balances come only from authoritative ledger entries and payout reservations — never UI counters or client-supplied values. Concurrent claims cannot spend the same funds twice.

## Delivered
- Migration `20261029010010_gh_earnings_available_balance_phase6.sql`
  - `gh_earnings_payout_policy` (min/max/fee atomic)
  - `gh_earnings_withdrawable` snapshot RPC
  - Concurrent-safe `gh_earnings_reserve` with `pg_advisory_xact_lock`
  - `gh_earnings_release_reserve` compensating entry
- Server: `getWithdrawableBalance`, `releaseEarningsReservation`, `floorPiToAtomic`
- API: `GET /api/economy/earnings/withdrawable`

## Policy defaults
- Min payout: 0.1 PI (1_000_000 atomic)
- Max single: 100 PI
- Fee: 0
- Rounding: floor to integer atomic units

## Not claimed
- Live Testnet receipt
- Remote migration applied
- UI wallet screen redesign (Phase 8)
