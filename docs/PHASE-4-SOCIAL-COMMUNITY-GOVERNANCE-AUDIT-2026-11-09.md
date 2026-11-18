# Phase 4 — Social graph, community access, and moderation audit

**Baseline:** `gh-connect@0.338.13` (source archive carried forward from Phase 3)  
**Status:** Partially complete; source-level controls improved, external database verification outstanding.

## Scope

Reviewed the server routes and supporting source for follow/block relationships, feed visibility, community moderation/report handling, and the durable governance migration `20261107170001_phase7_durable_community_governance.sql`. This is a source audit; it is not a live Supabase or PostgreSQL execution test.

## Confirmed source change

`app/api/social/blocks/route.ts` previously trimmed the requested target and rejected empty/self targets, but did not apply the shared `sanitizeTargetUserId` checks used by the follow endpoint. It now uses that sanitizer and the shared human-readable error mapping. The actor continues to come exclusively from the authenticated server session. This also rejects overlong/control-character/demo-placeholder targets consistently across follow and block flows. No schema or API payload shape was intentionally changed for valid existing target IDs.

Regression coverage:

- `scripts/test-social-target-id-sanitizer.mjs`: expanded to 12 runtime assertions.
- `scripts/check-phase4-social-community-boundaries.mjs`: 9 source-boundary checks, registered in `prebuild` and `verify:static`.

## Findings supported by source

- Follow and block mutations derive actor identity from the authenticated session, not a client actor ID.
- Block writes use the durable rate-limit control with `onUnavailable: "deny"`.
- Feed reads require the canonical visibility filter and fail when visibility/author identity cannot be verified.
- Visibility checks account for bidirectional blocks, follower/mutual visibility, community membership, and deleted/archived state in the reviewed helper/RPC source.
- Community governance report and moderation-history routes authenticate the actor and require a community moderator role for privileged operations.
- The durable moderation append RPC rechecks the actor's community role inside the database operation, and its migration restricts execution to `service_role`.

These are source-level observations only; they do not establish that a particular database has applied the migrations or grants.

## Verification run

- Phase 4 social/community boundary checks: **9/9 passed**.
- Shared social target-ID sanitizer runtime checks: **12/12 passed**.
- Phase 3 architecture boundary checks: **7/7 passed**.
- Phase 7 community governance closeout checks: **10/10 passed**.
- Priority 7 community transformation checks: **13/13 passed**.
- Repository consistency: **6/6 passed** (including 1,457-file import resolution and npm script target checks).

Full TypeScript, lint, and production build were not claimed. The current runtime is Node 22.16.0 while `.nvmrc` requires Node 24.15.0, and dependencies are not installed in this audit runtime.

## Open blockers before phase closeout

1. Run social visibility and governance tests against a disposable PostgreSQL/Supabase instance with the exact migration set.
2. Verify actual Testnet and Mainnet migration histories independently; the migration `20261107170001_phase7_durable_community_governance.sql` remains `REVIEW_REQUIRED` in project documentation and must not be presumed applied.
3. Test concurrent moderator-role removal against moderation/report writes, block/unblock vs follow races, and private/community post visibility under block/membership changes.
4. Review all sensitive social endpoints manually for actor ownership, report target existence/authorization, block enforcement on read and write paths, and moderation audit completeness.
5. Execute browser/mobile acceptance for report submission, moderator queue, block/follow UX, and error/retry states.

## Safety boundary

No migration was applied, deleted, renamed, or reordered. No remote database, secret, environment setting, payment flow, or dependency version was changed. No Testnet/Mainnet or production behavior is declared verified by this source-only pass.
