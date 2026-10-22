# Remote migration reconciliation — existing-deployment operator gate

**Clean-baseline status:** the four local filename collisions in this archive have been resolved by assigning unique numeric versions. For a genuinely new Supabase project with no migrations applied, do not run the remote-history comparison just to authorize these local renames; there is no prior history to preserve. First verify the target project is empty, then validate the migration set on disposable PostgreSQL/Testnet before applying anything.

**Existing deployment status:** if any environment has already applied migrations from an earlier archive, capture that environment’s history before changing filenames or applying this revised baseline. The renames change migration identity and are not automatically safe for a database that has recorded the older version prefixes. Testnet and Mainnet histories must be handled independently.

## Resolved local version identities

| Numeric version | Migration | Dependency / role |
|---|---|---|
| `202610170001` | `20261022010068_ghpv_settlement_engine.sql` | GHPV settlement engine; depends on the earlier GHPV infrastructure chain. |
| `202610170002` | `20261022010069_match_signals_durable.sql` | Durable matching signals; independent matching feature. |
| `202610170003` | `20261022010070_ghpv_calibration_bounds.sql` | Hardens the settlement function after the settlement engine. |
| `202610180012` | `20261022010080_gh_engagement_rosters.sql` | Social reaction, vote, viewer and comment-emoji roster RPCs. |

These migrations are distinct and retained. The inventory generator now rejects duplicate numeric prefixes so a future collision fails the source check.

## Capture both histories without changing project linkage

Use a trusted shell where the Supabase CLI is installed and the two database URLs are available as environment variables. Do not enable shell tracing (`set -x`) and do not paste connection URLs or secrets into chat.

```bash
supabase migration list --db-url "$GH_TESTNET_DB_URL" > /tmp/gh-testnet-migrations.txt
supabase migration list --db-url "$GH_MAINNET_DB_URL" > /tmp/gh-mainnet-migrations.txt
node scripts/reconcile-remote-migration-histories.mjs \
  --testnet /tmp/gh-testnet-migrations.txt \
  --mainnet /tmp/gh-mainnet-migrations.txt \
  --out /tmp/gh-remote-migration-reconciliation.md
```

The command only reads the two saved CLI outputs and local filenames. It does not connect to a database, modify migrations, or run `db push`. For a new empty project, this is optional and is only useful as a recorded baseline after initial application. Inspect the generated report for each environment independently. If your CLI version does not support `--db-url`, use an isolated checkout/config per environment and `supabase migration list --linked`; do not relink a shared working tree casually.

## Resolution rules

1. Preserve raw Testnet and Mainnet outputs as dated evidence. Do not share database URLs or credentials.
2. Compare each remote version set with every local filename prefix; investigate remote-only versions, local-only versions, duplicate prefixes, and any drift between repository history and actual schema.
3. Inspect SQL and dependencies on a disposable PostgreSQL database. A matching remote version is not a checksum and does not prove identical SQL was applied.
4. Decide the final identity of each duplicate only after the remote evidence and schema state are understood. If a version is already recorded remotely, do not simply rename a local file: plan a controlled history repair or a new forward migration only after environment-specific review.
5. Move a genuinely unapproved proposal outside `supabase/migrations/` only after confirming it is unapplied in both environments and checking references/tooling. Keep a reviewed archive outside the executable migration directory.
6. Keep `supabase db push` blocked until all duplicate identifiers, pending SQL, dependencies, and environment divergences are resolved and approved.

## Automated local checker

- `npm run test:migration-history-reconciler` tests the read-only comparison tool with synthetic CLI outputs.
- `npm run reconcile:remote-migrations -- --testnet <path> --mainnet <path>` runs the checker; it exits with a blocking status while local duplicate version identifiers remain.

The checker compares version strings only. It is not SQL validation, does not compare remote checksums, and does not certify live security behavior. A clean local inventory does not mean every migration is approved for blanket application; follow `docs/MIGRATION_CHECKLIST.md` and the per-migration review gates.
