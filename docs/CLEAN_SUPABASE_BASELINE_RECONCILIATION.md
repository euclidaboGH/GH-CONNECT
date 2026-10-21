# Clean Supabase baseline reconciliation — GH-CONNECT 0.63.25

## Scope

This update prepares the reviewed source archive for a genuinely new Supabase project whose migration history is empty. It does not connect to Supabase, execute SQL, or certify a live deployment.

## Resolved migration identity collisions

All 109 SQL migration files now have unique numeric prefixes. Four distinct migrations were retained and assigned unique identities:

- `202610170001_ghpv_settlement_engine.sql`
- `202610170002_match_signals_durable.sql`
- `202610170003_ghpv_calibration_bounds.sql`
- `202610180012_gh_engagement_rosters.sql`

The settlement engine precedes its calibration hardening. Matching signals and engagement rosters remain separate migrations. The inventory generator now fails if a future change introduces a duplicate numeric prefix or a migration filename without a numeric prefix.

## Source checks completed

- Migration inventory: 109 files, 109 distinct numeric prefixes, no collisions.
- Generated checklist and verified manifest: synchronized.
- Migration history reconciler regression: passed using synthetic saved outputs.
- Phase 3 security/migration contract: 25/25 passed.
- GHPV settlement checks: 23/23 passed.
- GHPV calibration checks: 18/18 passed.
- GHPV foundation checks: 14/14 passed.
- Engagement roster security: 10/10 passed.
- Social visibility: 14/14 passed.
- Story creator: 12/12 passed.
- Messaging reliability: 32/32 passed.
- Content reward boundaries: 20/20 passed.
- Phase 15 account/payout source checks: 25/25 passed.
- Phase 17 media/financial source checks: 18/18 passed.
- Phase 19 financial/media readiness: 29/29 passed.
- Phase 20 payout adapter source checks: 19/19 passed.
- Phase 22 Paystack bank payout source checks: 42/42 passed.
- Release gate policy: 9/9 passed.
- Project truth checks: 14/14 passed.

These are static/source checks, not PostgreSQL execution or live integration tests.

## Important deployment boundary

Do not interpret `REQUIRED`, `REVIEW_REQUIRED`, `PROPOSAL`, or `REQUIRES_APPROVAL` labels as controls enforced by Supabase CLI. `supabase db push` applies pending migrations found in the configured migrations directory; it does not automatically skip files based on documentation labels.

Before the first apply to the new project:

1. Confirm the target Supabase project is the intended empty Testnet project, not Mainnet.
2. Review `docs/MIGRATION_CHECKLIST.md` and resolve the two proposal migrations and the one requires-approval migration so they cannot be applied accidentally.
3. Validate the complete intended migration chain on disposable PostgreSQL or an isolated Testnet project, including dependencies, SQL syntax, RLS, grants, RPC signatures and ordering.
4. Run post-migration assertions and multi-account authorization tests.
5. Keep Pi A2U, Paystack transfers, GHC seller payouts, reward settlement and other financially critical execution paths disabled until their explicit gates pass.
6. Only then apply the approved chain to the new Testnet project and verify the app against it. Do not apply this renamed history to an existing environment that recorded the old prefixes without separate reconciliation.

No claim is made here that the full build, live Pi flows, live provider behavior, or a complete PostgreSQL migration run has passed.
