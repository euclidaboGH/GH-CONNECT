# Phase 1 — Deep completion and reconciliation

**Release:** `0.315.6`  
**Baseline:** `0.315.5`  
**Status:** Source implementation and static regression gates complete; runtime, disposable PostgreSQL, Testnet and Mainnet-history gates remain open.

## Additional source corrections

1. Curation preflight now delegates post access to `gh_post_viewer_can_read`, aligning curation with Feed/Profile visibility and covering blocks, followers, mutual follows, archived/deleted posts, and active membership for community-bound posts.
2. Self-curation is consistently denied by the final preflight and atomic write pipeline. Historical guard/allowance migrations are explicitly reconciled by a later additive migration; self-curation cannot enter independent review, weighted settlement, or reward logic.
3. Per-user daily curation mutation checks are serialized with a transaction-scoped advisory lock before preflight, preventing concurrent requests on different posts from bypassing the 120-action daily cap.
4. Curation activity audit persistence is now mandatory in the atomic transaction. An audit failure raises and rolls back the vote, GHPV state and reward decision together.
5. Community-feed keyset ordering now uses the same epoch-millisecond/id ordering key in both its cursor predicate and `ORDER BY`, avoiding precision-order mismatch.
6. Community board refresh preserves the last known-good canonical posts during transient failures and ignores stale in-flight responses.
7. Community board publishing now awaits an explicit success result, disables duplicate submissions while publishing, and clears the composer only after confirmed success.
8. Added `scripts/check-phase1-deep-completion-20261106.mjs` with 19 targeted regression assertions; registered in `prebuild` and `verify:static`.

## New migration

`supabase/migrations/20261106110001_phase1_curation_community_guard_reconciliation.sql`

Classification: `REVIEW_REQUIRED`.

Dependencies include the existing canonical `gh_post_viewer_can_read`, curation, GHPV, community role and activity-event functions/tables. The migration changes no GHC ledger, wallet balance, Pi payment, payout, or reward issuance authority.

## Verification

- Existing `npm run verify:static`: PASS, 57/57 consolidated checks plus all registered targeted contracts.
- Phase 1 social foundation: 12/12.
- Curation intelligence refresh recovery: 10/10.
- Post/curation production contract: 12/12.
- Community global-standard contract: 11/11.
- Repository consistency: 6/6.
- New Phase 1 deep completion contract: 19/19.
- Migration source inventory: 184 canonical files, duplicate numeric prefixes: 0, manifest/checklist/apply guide synchronized.

All checks above are source/static checks. They do not prove SQL execution against PostgreSQL, a successful Node 24 build, applied Supabase migrations, or live user workflows.

## Remaining release gates

- Install dependencies with Node `24.15.0` / supported Node 24 and `npm ci --legacy-peer-deps`.
- Run `npm run typecheck`, `npm run lint`, `npm run build`.
- Validate all held Phase 1 migrations on disposable PostgreSQL against the exact preceding schema.
- Reconcile Testnet and Mainnet migration histories independently before any apply decision.
- Test two-user and multi-user curation concurrency, daily cap boundaries, self-vote denial, member/non-member community access, blocks, followers/mutuals, cursor page boundaries, reaction/save/comment/share flows, and durable post creation/refresh in Testnet.
- Verify a community board post is visible in Feed/Profile/Community after reload and a fresh authenticated session.

**Phase 1 is source-complete, but not production-certified. Phase 2 remains blocked until these runtime/database/operator gates are closed.**
