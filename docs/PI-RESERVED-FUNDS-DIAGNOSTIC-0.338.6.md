# Pi "Reserved" funds not releasing — operator diagnostic (read-only)

Symptom: wallet shows Reserved 3.00 π, Available 0.00 π, and "Check for releasable requests" reports
"Couldn't verify the reservation state". The cancel API now returns a specific `error` code and logs
`[pi-earnings-cancel] rpc failed {status, code, message}` in Vercel function logs.

| Code shown in app | Meaning | Action |
|---|---|---|
| PAYOUT_RECOVERY_MIGRATION_PENDING | RPC `gh_pi_earnings_payout_cancel_unstarted` is missing/mismatched on the target DB | Review and apply `20261107130001` / `20261108110001` per the manifest (REVIEW_REQUIRED) |
| RESERVATION_RELEASE_REJECTED | `gh_earnings_release_reserve` raised (e.g. INSUFFICIENT_RESERVED_TO_RELEASE); whole call rolled back | Run query 2, reconcile ledger vs request rows |
| EARNINGS_LEDGER_UNAVAILABLE | DB unreachable / timeout / service key missing | Check Supabase status and env |

Run in the Supabase SQL editor (read-only). Replace `<USER_ID>`.

```sql
-- 1) Requests holding the reservation
select id, status, gross_atomic, network, provider_payment_id, provider_txid,
       execution_started_at, execution_lease_token, execution_attempts, failure_code, created_at
from public.gh_pi_earnings_payout_requests
where user_id = '<USER_ID>' order by created_at desc;

-- 2) Reserved amount per payout request according to the ledger
select payout_request_id,
  sum(case when entry_type='reserve'         and status='reserved'  then amount_atomic
           when entry_type='settle'          and status='paid'      then -amount_atomic
           when entry_type='release_reserve' and status='available' then -amount_atomic
           else 0 end) as still_reserved
from public.gh_earnings_ledger_entries
where user_id = '<USER_ID>' and asset = 'PI'
group by payout_request_id having sum(case when entry_type='reserve' and status='reserved' then amount_atomic
  when entry_type='settle' and status='paid' then -amount_atomic
  when entry_type='release_reserve' and status='available' then -amount_atomic else 0 end) <> 0;

-- 3) Is the RPC present?
select proname, pronargs from pg_proc where proname = 'gh_pi_earnings_payout_cancel_unstarted';
```

Reading the result: a `reserved` request with no provider id/txid, no execution_started_at and 0 attempts is
releasable by the user. `processing`/`uncertain` requests, or `reserved` ones the worker already touched, stay
held until Pi's outcome is verified — by design. A ledger reservation whose `payout_request_id` has no matching
request row (query 2 vs 1) needs operator reconciliation; it is never force-released by the app.
