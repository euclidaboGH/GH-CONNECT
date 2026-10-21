# Company revenue journal — disposable PostgreSQL validation

This test harness exercises the actual SQL migration against a **new disposable PostgreSQL database**. It is intentionally separate from `ci:verify` because it needs a live PostgreSQL server and an explicitly designated throwaway database.

## Coverage

- RLS enabled and no direct table privileges for `anon`, `authenticated`, or `service_role`.
- Append RPC executable by `service_role` only (not `anon` or `authenticated`).
- First append and exact retry produce one canonical row.
- Reusing the idempotency key or provider event ID for a different event is rejected.
- Generated net amount is correct.
- `UPDATE` and `DELETE` are rejected by the append-only trigger, including for the table owner.
- Zero-value and unverified events are rejected.
- Two independent PostgreSQL sessions append the same event concurrently; the client retry contract returns one canonical event ID, with one insert and one duplicate response.

## Run

1. Provision a **new empty disposable database** on PostgreSQL 13 or newer. The migration needs a privileged database role to create roles and objects. Do not use Testnet, Mainnet, or any database with data you need.
2. Ensure `psql` and Node.js are installed.
3. Set the connection URL only in your trusted terminal (never paste credentials into chat):

```bash
export GH_REVENUE_TEST_DATABASE_URL='postgresql://.../gh_revenue_disposable'
export GH_ALLOW_DISPOSABLE_DB=1
npm run test:company-revenue-postgres-disposable
```

The runner requires the database name to contain `disposable`, `scratch`, `revenue_test`, or `test_revenue`; it will refuse otherwise. It creates test roles if missing and applies the migration. Because this is a fresh-database test, do not rerun it against the same database; create a fresh empty disposable database for each run.

## Evidence status

The source-level revenue invariant test passes in the current workspace. The live PostgreSQL integration suite has **not** been executed in this workspace because no PostgreSQL server/client (`postgres`, `initdb`, `psql`) is installed or available. Do not mark the journal database-validated until this command completes successfully against disposable PostgreSQL and its output is retained as release evidence.
