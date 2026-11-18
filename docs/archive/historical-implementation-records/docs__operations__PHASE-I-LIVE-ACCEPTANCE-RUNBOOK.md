# GREENHAVEN Phase I — Live Acceptance Runbook

This runbook is an operator checklist, not evidence that an environment has been tested. Execute separately for Supabase staging/Testnet and production; never copy production secrets into local logs or commit them.

## 1. Migration history reconciliation

1. Freeze schema changes and record project ref, environment, UTC timestamp and operator.
2. Export source migration inventory: `npm run check:migration-inventory` and `npm run check:migration-release-readiness`.
3. Query the target Supabase SQL editor (read-only):

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

4. Compare the result with the exact migration filenames in `supabase/migrations/` and `MIGRATION-SOURCE-MANIFEST.csv`. Compare by migration version, not filename alone. Identify: applied-and-present, source-only/unapplied, applied-but-source-missing, duplicate version, and failed/partial migration.
5. Do not mark source-only migrations as applied. Do not repair history with manual inserts/deletes. Resolve every drift item with a reviewed forward migration and Supabase-supported recovery process.
6. Capture RLS, grants, function owners, SECURITY DEFINER search paths and `EXECUTE` ACLs for privileged RPCs. Store redacted outputs with the release evidence.

## 2. Backup, isolated restore and PITR

1. Record configured Supabase plan, backup schedule, retention and PITR availability from the actual project dashboard/contract.
2. Obtain a fresh custom-format `pg_dump` or provider-supported backup. Record UTC creation time, source project ref, size and SHA-256.
3. Run `node scripts/verify-database-backup-artifact.mjs <artifact.dump> --max-age-hours=24` (adjust age only with an approved reason). This verifies the archive catalog, not recoverability.
4. Restore into a disposable isolated PostgreSQL project/instance with no production network routes, outbound provider keys, cron workers or payment integrations. Use a different project/database identity.
5. Run schema, RLS, grants, critical RPC, row-count and referential-integrity checks. Verify the app can read the restored data using test-only credentials.
6. For PITR, restore to a timestamp before a controlled test marker and another timestamp after it; verify the marker boundary and recovery timestamp. Never perform a PITR restore over the live project as a test.
7. Record achieved RPO/RTO, restore duration, missing objects, operator and evidence hashes. A backup is accepted only after a successful isolated restore.

## 3. Pi Testnet payment/payout acceptance

1. Confirm the Pi Developer Portal app is Testnet, callback URLs are correct, and server secrets are server-only. Never use Mainnet keys or real funds in this rehearsal.
2. Use dedicated test accounts and low-value test transactions. Capture request ID, idempotency key, provider payment ID, provider txid, exact atomic amount, recipient binding and timestamps.
3. Test U2A approve/complete, duplicate callbacks, out-of-order callbacks, invalid signature/token, wrong user, wrong amount, wrong txid, timeout, provider unavailable, and retry after uncertain result.
4. For A2U, require server-side operator authorization, durable execution lease, provider acceptance evidence, read-after-write verification and exact receipt match before settlement.
5. Verify reserved funds remain reserved for uncertain/in-flight requests. Verify release only for provably unstarted requests under the existing release policy. Never force-release on timeout.
6. Reconcile provider receipts against the PI ledger; independently verify GHC remains untouched. Record every assertion and provider evidence.

## 4. Identity and authorization acceptance

- Test signup, login, logout, refresh, expired/revoked session, multi-device revocation, account recovery and PIN setup/recovery on clean accounts.
- Verify withdrawal PIN is app-side only and never sent to Pi Platform. Verify throttling, lockout, expiry, replay prevention and constant-time proof comparison.
- Run two-user IDOR tests against profile, wallet, statement, payout, membership, marketplace, community, message, report and admin/operator routes.
- Test anonymous, authenticated, moderator, support and admin roles; deny-by-default behavior; RLS and RPC ACLs; service-role keys never reach client bundles.

## 5. Rewards abuse acceptance

- Run duplicate and concurrent claim attempts for one reward/referral/campaign.
- Test self-referral, multi-account farming, device/IP velocity, invite loops, revoked eligibility, expired campaign, replayed idempotency key and cross-campaign caps.
- Verify ledger credit is server-derived, unique and exactly once; no client-provided amount can change reward value.
- Verify suspicious events are auditable and operator holds do not mutate balances.

## 6. Moderation operations acceptance

- Exercise report intake, duplicate reports, evidence retention, moderator queue assignment, triage, escalation, action, appeal and reversal.
- Test spam, harassment, threats, impersonation, fraud, illegal content and false-report abuse using synthetic test content.
- Verify least-privilege role boundaries, immutable audit trail, evidence access controls, retention/deletion policy, user notification and appeal visibility.
- Confirm moderators cannot directly change balances, payout status or payment receipts.

## 7. Transactional outbox enablement gate

- Review `docs/proposals/PHASE-I-TRANSACTIONAL-OUTBOX-DESIGN.sql` with database owner and security reviewer.
- Apply only to disposable PostgreSQL first; run `supabase/tests/phase1_transactional_outbox_rehearsal.sql` and add rollback/lease-expiry/concurrency tests.
- Integrate `gh_outbox_enqueue` into each owning business RPC so domain row + event are inserted in the same transaction. Do not call it as a second REST request after the mutation.
- Verify concurrent workers with `FOR UPDATE SKIP LOCKED`, lease fencing, retry backoff, max-attempt dead-letter, operator replay audit and consumer idempotency.
- Only after review and staging evidence should a timestamped migration be added to `supabase/migrations/` and the source manifest regenerated. Do not enable the worker before migration deployment and handler registration.

## Sign-off record

For each environment record: project ref, migration diff, backup hash, restore timestamp, RPO/RTO, Pi Testnet run IDs, auth/IDOR results, rewards abuse results, moderation evidence, outbox concurrency results, operator, reviewer and approval date. Production remains blocked while any mandatory evidence is missing.
