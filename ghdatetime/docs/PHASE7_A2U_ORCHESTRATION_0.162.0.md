# Phase 7 — Shared A2U payout orchestration (0.162.0)

## Goal
One hardened foundation for cashback and seller A2U: incomplete recovery, durable review, stuck detection, and **never mark paid solely because a request was sent**.

## Delivered
- Migration `20261029010009_pi_a2u_shared_orchestration.sql`
  - `gh_pi_a2u_review_queue`
  - enqueue / resolve / list open / list stuck RPCs
- `lib/server/payments/a2u-orchestration.ts`
  - provider binding, matching incomplete, `canMarkA2uPaid`, review helpers
- Cashback claim + seller create enqueue review on unrelated incomplete
- `GET|POST /api/payments/a2u/orchestration` (operator key)

## Rules enforced
1. Prefer matching incomplete recovery over createPayment
2. Unrelated incomplete → attention (cashback) + review queue
3. Settlement gate requires developer_completed + binding + verified txid

## Not claimed
- Live Testnet receipt
- Phase 6 full available-balance calculator (partial via Phase 3 ledger)
- Remote migration applied
