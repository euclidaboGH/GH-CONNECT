# RUN333 — Existing Testnet branch security reconciliation

**Date:** 2026-11-18
**Base:** RUN332 advanced audit remediation archive
**Target:** Existing GH Connect Supabase Testnet project `tpckwgdsjlkzscjlxiwe` (PostgreSQL 17.11)
**Database branch strategy:** Used the existing Testnet project directly; no additional Supabase development branch was created.

## Applied, verified security correction

The live catalog showed eight RLS-enabled server-only tables with redundant `SELECT` grants to `authenticated`. A narrowly scoped migration was applied:

- Migration: `20261118033839_revoke_client_select_on_server_only_tables`
- Source: `supabase/migrations/20261118033839_revoke_client_select_on_server_only_tables.sql`
- Tables: `gh_verification_requests`, `ghc_account_flags`, `ghc_community_moderation_log`, `ghc_community_reports`, `ghc_connection_contexts`, `ghc_connection_requests`, `ghc_match_signals`, `ghc_user_blocks`.
- Operation: `REVOKE SELECT` from `PUBLIC`, `anon`, and `authenticated` only.
- No policy was added. No service-role privilege was reduced. No rows were changed.

### Postflight results

All eight target tables still have RLS enabled. `PUBLIC`, `anon`, and `authenticated` have no effective SELECT privilege on any target table. `service_role` retains SELECT, INSERT, UPDATE, and DELETE on all eight. Supabase migration history now reports **46 entries**, with the new migration recorded as `20261118033839`.

The original review proposal is retained as an audit note and marked superseded. The canonical migration inventory has been regenerated to **230 files**, and the Testnet apply-order guide, verified manifest, migration checklist, and source manifest now include the new migration.

## Research/election database readiness after the read-only postflight

The current Testnet catalog confirms `gh_research_projects` exists, but the dependent `gh_research_members`, `gh_research_geo_units`, `gh_research_election_contests`, `gh_research_candidates`, `gh_research_agent_assignments`, `gh_research_tallies`, `gh_research_tally_candidate_votes`, and `gh_research_election_tally_submit` objects are absent. The new field-agent desk therefore returns a fail-closed unavailable state on this Testnet until the held foundation and dependent migrations are safely rehearsed and applied. No assignments, tally records, election results, geographic rows or evidence records were created.

## Additional Testnet catalog observations

- Core community, messaging, feed, and call tables are present, including `gh_call_sessions`, `gh_call_signals`, `gh_messages`, `gh_message_reactions`, `gh_message_receipts`, and `gh_feed_preferences`.
- Their inspected indexes were valid.
- The sampled public SECURITY DEFINER functions were not executable by `anon` or `authenticated`; many are restricted to `service_role`.
- A separate catalog query identified numerous legacy service-role-only SECURITY DEFINER functions whose configured search path is only `public`. They are not client-executable, but remain a hardening candidate. Do not mass-alter them without reviewing function bodies for extension dependencies and qualified object references.
- The three research/media/scoped-evidence migrations remain held. The scoped evidence migration source was further hardened in RUN333 with a per-evidence transaction advisory lock before reading/allocating the next hash-chain sequence, preventing concurrent scanner/review updates from forking the chain. This correction is source-only and has not been applied. The source archive and the GitHub `testnet` copies of two of those files differ in byte length; do not substitute GitHub copies for the exact archive source.
- Twenty applied history entries still have no matching source filename in RUN332; eleven others have a same-slug/different-version source candidate whose semantic equivalence is not proven. These records are not repaired by this run.

## Phase 5 election tally UI and independent comparison source implementation

RUN333 adds the missing authenticated field-agent tally desk to Research Studio. It loads only the signed-in user's active project memberships, accepted/pending assignments, active contests, active candidates, and exact assigned geography. Field agents can accept only their own pending assignment within its configured time window; the acceptance route rechecks active project membership. The atomic SQL proposal independently rechecks active membership at submission time. Submission is enabled only when the assigned geography is an active `polling_unit` with an external code plus non-empty source reference/version, and the contest has active candidates. The agent can accept only their own pending assignment, within its active time window, after the server rechecks active project membership. The actor identity is never accepted from browser input; the existing POST route derives it from the authenticated session and calls only the atomic tally RPC. Count consistency is checked in the browser for usability and revalidated server-side/inside the SQL function.

A new owner/reviewer-only, read-only reconciliation endpoint compares submissions grouped by exact polling-unit identity. It requires at least two distinct agents for a `consistent` result, flags count/candidate mismatches, bounds the query to 250 tally rows, refuses partial results, masks agent identities, and always returns `certified=false`. The Research Studio displays the comparison without any certification or winner-publishing action.

The held atomic tally SQL proposal now additionally requires `level_key='polling_unit'`, exact `external_code` equality with the submitted polling-unit code, and non-null `source_ref`/`source_version`. It also requires the complete active-candidate set (1–100 candidates) at submission time. This prevents a browser from splitting one geographic unit across arbitrary codes and prevents unproven geography rows or incomplete candidate sets from receiving tallies. The proposal remains unapplied because the Research Intelligence foundation is still held and no approved geography dataset is loaded.

Pure reconciliation tests pass 6/6 and the source gate passes 13/13. This closes the source/UI gap only; it does not create an authoritative geography dataset, apply the atomic tally function, or certify any election result.

## Verification and release status

- `npm run verify:static`: PASS on available Node 22.16.0 runtime, including the new election tally/reconciliation source gate and runtime tests.
- Changed TypeScript/TSX files: syntax transpilation PASS 7/7 using the globally available TypeScript 5.8.3 compiler; this is not a substitute for the full project typecheck.
- A clean `npm ci` was attempted but did not complete within the available network/tool window. The installed Node runtime is 22.16.0, while the project requires Node `^24.15.0`; no typecheck, lint or production build is certified for this run.
- No GitHub push or Vercel deployment occurred.
- Mainnet project `rrrtjowuldcpbjobbpic` was not modified.
- No wallet, payment, payout, reward, membership, account, election tally, or user data rows were changed.

**Release status: NOT APPROVED.** This run closes the narrow client SELECT grant gap on Testnet only. It does not reconcile the missing historical migration source, certify research/evidence migrations, configure the scanner/geography providers, populate authoritative geography data, apply the atomic tally RPC, or provide supported-runtime/browser acceptance.
