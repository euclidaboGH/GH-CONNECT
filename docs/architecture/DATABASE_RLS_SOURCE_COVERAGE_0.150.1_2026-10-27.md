# GreenHaven database RLS source coverage audit — v0.150.1

**Scope:** static inspection of timestamped SQL migration source only. This report does not connect to Supabase and is not evidence of deployed database state.

## Current source inventory

- 114 distinct executable table names discovered from migration `CREATE TABLE` statements.
- All 114 have an explicit `ENABLE ROW LEVEL SECURITY` statement somewhere in the migration source.
- 103 tables have at least one `CREATE POLICY` statement in source.
- 11 tables have no client policy in source and are explicitly listed in `scripts/check-database-rls-coverage.mjs` for operator/service-role review: `gh_company_revenue_events`, `gh_security_events`, `gh_security_rate_limit_buckets`, `gh_verification_requests`, `ghc_account_flags`, `ghc_community_moderation_log`, `ghc_community_reports`, `ghc_connection_contexts`, `ghc_connection_requests`, `ghc_match_signals`, and `ghc_user_blocks`.

The no-policy allowlist is not an assertion that the tables are safe. Confirm that each is intentionally inaccessible to end-user roles, that service-role credentials are only held server-side, and that grants do not accidentally permit access through another role.

## Required staging/production follow-up

1. Compare the deployed schema with the intended migration history for each environment; do not apply or rename migrations based on lexical order alone.
2. Query `pg_class.relrowsecurity` and `pg_class.relforcerowsecurity` for all application tables and inspect grants in `information_schema.role_table_grants`.
3. Review every policy's `USING` and `WITH CHECK` predicates, including ownership, conversation membership, community role, and update-column boundaries.
4. Run negative multi-user tests: user A must not read or mutate user B's private messages, media, profile-private fields, community moderation records, account flags, or financial records.
5. Verify `SECURITY DEFINER` function ownership, fixed `search_path`, explicit execute grants/revokes, and authorization checks using the deployed catalog.

## Guardrail

`npm run check:database-rls-coverage` is a static source guard. It is useful for catching missing RLS enablement and newly introduced no-policy tables, but it cannot prove policy semantics, runtime behavior, or live database configuration.
