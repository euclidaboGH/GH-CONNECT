# GH-CONNECT Phase 2 — Post-card, curation, and action integrity

Date: 2026-11-01
Baseline: GH-CONNECT v0.274.3 Phase 1 source tree

## Scope

Phase 2 targets the reported failure where users cannot reliably curate posts, and ensures post cards reflect authoritative persisted state. The consolidated migration bundle from Phase 1 is preserved. No migration was added or applied in this phase; the canonical inventory remains 175 migrations.

## Confirmed defects addressed

### 1. Curation endpoint accepted incomplete atomic-RPC success responses

Previously, the endpoint treated an RPC result as successful unless `result.ok` was false or `data.ok` was explicitly false. A malformed/incomplete response could therefore pass through without an explicit `data.ok === true`, a valid server-returned choice, authoritative upvote/downvote counts, a confirmed reward decision, or a confirmed GHPV write. The response also defaulted missing vote counts to zero, masking missing data as a legitimate zero count.

Fix:
- Requires explicit `data.ok === true`.
- Requires a valid server-returned choice (`upvote`, `downvote`, or `neutral`).
- Requires non-negative safe-integer upvote and downvote counts.
- Requires explicit successful reward decision, a boolean `credited` flag, and a finite non-negative amount.
- Requires explicit successful GHPV write and a finite non-negative weight.
- Returns `503 CURATION_COMMIT_UNCONFIRMED` with `durable: false` when the atomic commit receipt is incomplete.
- Does not manufacture zero counts for an incomplete response.
- Logs only sanitized contract diagnostics, not raw RPC data or secrets.

### 2. Mounted post cards could retain stale curation state

The canonical post card initializes selected vote and counts from its `post` props. If the same card instance remains mounted while feed/profile data refreshes, local state could retain stale counts or a stale selected vote.

Fix:
- Reconciles selected curation and vote counts when the server-backed post snapshot changes.
- Keeps user-visible state grounded in the canonical feed/profile snapshot.
- Keeps server-confirmed mutation response as the success source; no optimistic durable-success claim was introduced.

## Regression coverage

Added `scripts/check-phase2-curation-commit-receipt.mjs` with 8 source-contract checks. Registered it in `npm run verify:static`.

Checks cover:
- Explicit atomic RPC success.
- Valid server-returned choice.
- Both authoritative count fields.
- Reward and GHPV confirmation.
- Fail-closed handling of incomplete commit receipts.
- No fabricated zero vote counts.
- Server-backed post-card state reconciliation.

## Verification performed

- `node scripts/check-phase2-curation-commit-receipt.mjs`: 8/8 passed.
- `node scripts/check-phase-post-curation-production.mjs`: 12/12 passed.
- `node scripts/check-post-curation-dashboard.mjs`: 12/12 passed.
- `node scripts/check-migration-source-manifest.mjs`: 175/175 synchronized.
- `node scripts/check-migration-master-bundle.mjs`: 175/175 source files byte-for-byte synchronized.
- `npm run verify:static`: passed, including Phase 1, Phase 2, and Phase 3 source-level contracts.

## Research and architecture decisions

The current official Pi Platform API documentation states that server-side payment credentials must remain backend-only and describes the platform API as the server-side interface for identity and payment operations. That principle is mirrored here: curation authority and durable commit state are accepted only from the server-side atomic RPC, not inferred from client input or missing response fields.

References:
- https://developers.minepi.com/docs/api-reference/Platform
- https://developers.minepi.com/docs/api-reference/PlatformAPI

## Not claimed as verified

This phase did not connect to the user's live Supabase database or Pi Testnet, apply migrations, run a browser/device interaction test, or execute TypeScript/ESLint/production build under the required Node 24 runtime. Source-level regression checks passing does not prove the live deployment has the expected RPC definitions or privileges.

## Operator next steps

1. Deploy the source to a preview environment using the supported Node 24 runtime.
2. Verify the deployed schema contains the canonical atomic curation RPC and its dependencies.
3. Use two test accounts to verify upvote, downvote, toggle-to-neutral, and refresh persistence on public and permitted follower-visible posts.
4. Confirm that incomplete/failed RPC responses produce an error, never a false saved state.
5. Continue Phase 3 work on story experience, navigation, visual system, and interaction consistency only after this curation path is confirmed in preview.
