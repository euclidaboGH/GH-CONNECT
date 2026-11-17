# Run #297 — Automatic 24-hour release of stale Pi / GHC holds (candidate)

Baseline: 0.338.56 / Run #296. Not applied, pushed or deployed by this run.

## What it does
- `supabase/migrations/20261112100001_financial_stale_hold_reaper.sql` adds `gh_financial_release_stale_holds(max_age_hours, dry_run, limit)` (service_role only, dry run by default, age floor 24h).
  - Pi earnings: `reserved` payout requests older than 24h that never reached provider execution are released via `gh_earnings_release_reserve` (append-only ledger, same unique_ref as the app, idempotent).
  - GHC: `requested` / `under_review` / `approved` withdrawals with no settlement ref and no activity for 24h become `rejected`, which frees the virtual lock.
- `app/api/economy/maintenance/release-stale-holds/route.ts` calls it. Auth is `Authorization: Bearer $CRON_SECRET`; returns 503 if `CRON_SECRET` (min 16 chars) is not set. `?dryRun=1` previews.
- `vercel.json` cron: daily at 03:17 UTC.
- `scripts/check-run297-stale-hold-reaper.mjs` (`npm run check:run297-stale-hold-reaper`).

## Deliberately not auto-released
Pi `processing` / `uncertain` requests and anything with an execution attempt, lease, provider id, txid or receipt; GHC `processing` withdrawals. A missing provider id is not proof Pi sent nothing, so releasing could credit a user twice. They are returned in the response (`held`) for provider reconciliation via `gh_pi_earnings_payout_release_verified_failure`.

## Operator steps
1. Review and apply the migration to Testnet (history is unreconciled: apply this one file only, never `db push`).
2. Set `CRON_SECRET` in Vercel; call the route with `?dryRun=1` first.
3. Daily cron means a hold is released 24–48h after creation. Hourly (`0 * * * *`) needs a Vercel plan that allows it.

## Not covered
Marketplace inventory/payment claims (already expire via `gh_marketplace_release_expired_reservations`), cashback and seller payout lanes, membership intents.

## Verification
Static contract passes. The SQL has not been executed on PostgreSQL; full Node 24 typecheck/lint/build outstanding. Production remains NOT APPROVED.
