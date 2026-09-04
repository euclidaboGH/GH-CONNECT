# ECONOMY VERSION 1.2 — Migration Safety Report

**Status:** Preview / pre-production. Do **not** apply to production without operator review.  
**Rule:** Additive only. No balance rewrites. No historical ledger mutation.

---

## 1. Required migrations (ECONOMY 1.2)

| Order | File | Purpose |
|------:|------|---------|
| 1 | `20260903_economy_v12_telemetry_note.sql` | Documentation / non-authoritative telemetry notes only |
| 2 | `20260903_economy_v12_claim_streak_and_population.sql` | `ghc_claim_streak_state`, `ghc_user_economic_status`, population + streak RPCs |
| 3 | `20260903_economy_v12_atomic_daily_claim.sql` | Unique earned-ref index + `ghc_execute_daily_claim_v12` |

**Prerequisite (already in repo, earlier):**

| File | Why needed first |
|------|------------------|
| `20260821_ghc_economy_ledger.sql` | Creates `ghc_transactions` and core ledger RPCs |
| Other `20260822_*` ledger/identity migrations | Public identities, RLS, transfer RPCs used by population stats |

Do **not** re-run destructive edits on `ghc_transactions` itself.

---

## 2. Dependencies

```
ghc_transactions (existing)
        │
        ├─► uq_ghc_earned_posted_ref          [atomic migration]
        │
        └─► ghc_execute_daily_claim_v12       [atomic migration]
                    │
                    ├─ reads/writes ghc_claim_streak_state   [streak migration]
                    └─ inserts earned rows (user + __PROTOCOL_RESERVE__)

ghc_public_identities / ghc_user_economic_status
        └─► ghc_economic_population_stats()   [streak migration]
```

---

## 3. Order of execution

1. Confirm core ledger migrations already applied (`ghc_transactions` exists).  
2. Apply `20260903_economy_v12_telemetry_note.sql` (optional, comments only).  
3. Apply `20260903_economy_v12_claim_streak_and_population.sql`.  
4. Apply `20260903_economy_v12_atomic_daily_claim.sql`.  
5. Run post-migration verification (section 5).

---

## 4. Preconditions

Before steps 3–4:

- [ ] Backup / point-in-time recovery available on Supabase/Postgres.  
- [ ] `ghc_transactions` exists and is the live ledger.  
- [ ] No need to drop/recreate financial tables.  
- [ ] Check for **duplicate** `(user_id, reference_id)` among posted `earned` rows (would block unique index):

```sql
SELECT user_id, reference_id, COUNT(*)
FROM public.ghc_transactions
WHERE kind = 'earned' AND status = 'posted' AND reference_id IS NOT NULL
GROUP BY 1, 2
HAVING COUNT(*) > 1;
```

If any rows return, resolve duplicates **manually** (prefer compensating entries, not DELETE of valid history) before applying the atomic migration.

---

## 5. Post-migration verification

```sql
SELECT to_regclass('public.ghc_claim_streak_state');
SELECT to_regclass('public.ghc_user_economic_status');

SELECT proname FROM pg_proc
WHERE proname IN (
  'ghc_economic_population_stats',
  'ghc_get_claim_streak',
  'ghc_commit_claim_day',
  'ghc_execute_daily_claim_v12'
);

SELECT indexname FROM pg_indexes
WHERE indexname IN (
  'uq_ghc_claim_streak_idempotency',
  'uq_ghc_earned_posted_ref'
);

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('ghc_claim_streak_state', 'ghc_user_economic_status');

SELECT COUNT(*) AS tx_count FROM public.ghc_transactions;
```

App-level: `npm run test:economy` then smoke one authenticated daily claim and a replay.

---

## 6. Object-by-object safety

| Object | Additive? | Client write? | Touches balances? | Notes |
|--------|-----------|---------------|-------------------|-------|
| `ghc_claim_streak_state` | Yes (`IF NOT EXISTS`) | No (RLS deny-all) | No | Empty until first claim |
| `ghc_user_economic_status` | Yes | No | No | Optional eligibility flags |
| `uq_ghc_claim_streak_idempotency` | Yes | — | No | Partial unique on non-null keys |
| `uq_ghc_earned_posted_ref` | Yes | — | No | Fails if duplicate earned refs exist |
| `ghc_economic_population_stats` | Yes (`OR REPLACE`) | service_role execute | No | SECURITY DEFINER + `search_path=public` |
| `ghc_get_claim_streak` | Yes | service_role | No | Read |
| `ghc_commit_claim_day` | Yes | service_role | No | Streak only (pre-atomic path) |
| `ghc_execute_daily_claim_v12` | Yes | service_role | **Append-only** inserts | Never UPDATEs historical amounts |

`DROP POLICY IF EXISTS` applies only to **new** tables’ deny-all policies — not data loss.

---

## 7. SECURITY DEFINER checklist

All v1.2 claim/population RPCs:

- `SECURITY DEFINER`
- `SET search_path = public`
- `GRANT EXECUTE … TO service_role` only

---

## 8. Rollback considerations

| Object | Practical rollback |
|--------|-------------------|
| Functions | Replace prior definition or drop if unused |
| New tables | Drop only if empty and never used for prod claims |
| Unique indexes | `DROP INDEX` does not delete rows |
| Posted claim ledger rows | **Do not DELETE**; use compensating entries |

**Never** roll back by deleting balances or rewriting history.

---

## 9. Data preservation guarantees

- Existing `ghc_transactions` rows: **untouched** by migration DDL.  
- Existing balances: **unchanged**.  
- No `TRUNCATE` / `DELETE FROM` / balance `UPDATE` in v1.2 SQL.

---

## 10. Operator note

This repository does **not** auto-apply migrations to production. Apply only after review.
