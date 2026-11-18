# Run #265 — Pi earnings payout recovery simulation

## Purpose

Exercise the high-risk recovery branches without spending Pi, creating provider payments, or changing Supabase data.

## Test scenarios

1. Provider timeout after an execution attempt preserves the reservation.
2. A never-started request can be released only with exact authoritative proof that no provider payment exists.
3. Missing or non-authoritative lookup evidence cannot release a reservation.
4. Release is idempotent.
5. An uncertain request resumes only the exact matching incomplete provider payment.
6. No replacement payment is created when the provider match is absent.
7. Request ID, recipient UID, amount and network mismatches block recovery.
8. Settlement requires a matching provider ID, request ID, UID, amount, network, direction, transaction verification, developer completion, txid and destination match.
9. Failed receipt checks do not settle.
10. Settlement is idempotent.

## Execution

```bash
node scripts/test-run265-payout-recovery-simulation.mjs
```

Expected result: `13/13 passed`.

This test is a pure in-memory simulation. It is not proof of live Pi provider state, does not prove database concurrency behavior, and must never be used to release or settle real user funds. Live recovery still requires provider-side evidence and the existing exact-amount ledger RPCs.
