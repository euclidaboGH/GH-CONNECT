# GH-CONNECT Roadmap Phase 4 — Communities & Governance

Date: 2026-11-02

## Confirmed defects addressed

- Offline community join returned `undefined` from a flow expected to report success/failure. It now returns `false`, preventing ambiguous outcomes and ensuring callers cannot interpret an offline attempt as successful.
- Rejected community-leave requests could escape the action handler and trigger an unhandled rejection or route-level error. The handler now catches failures, displays a retry-oriented message, and leaves local membership unchanged unless the domain operation explicitly succeeds.
- Rejected board-post requests could escape the action handler. Failures are now caught locally; production remains fail-closed and never fabricates a local successful post. The existing explicitly gated Studio/demo local fallback remains available.


- Community platform RPC inputs are now bounded and validated before dispatch: announcement titles/content, event titles/descriptions/location/virtual links, resource fields/URLs, report targets/notes, moderation target IDs, RSVP statuses, and report-resolution statuses.
- Event date ranges now reject an end time that is equal to or earlier than the start time.
- Event and resource URLs reject non-HTTP(S) schemes before reaching the RPC layer. Server-side authorization remains in the existing database RPCs; the route does not grant roles or fabricate durable success.
- Added `scripts/check-roadmap-phase4-community-platform-validation.mjs` and registered it in `prebuild` and `verify:static`.

## Regression coverage

`node scripts/check-roadmap-phase4-communities-governance.mjs` covers offline join result semantics, join busy-state cleanup, authoritative membership mirroring, visible failures, caught leave/post exceptions, and production fail-closed behavior. It is registered at the beginning of `prebuild` and `verify:static` and exposed as `npm run check:roadmap-phase4-communities-governance`.

## Scope and safety

No database schema, migrations, payment flows, authorization policy, role capability, RLS policy, or dependency version was changed. No moderation action is fabricated and no server-backed membership is claimed after a rejected request.

## Scope still requiring backend work

This patch hardens existing community actions and error recovery; it does not claim the full 10-feature governance roadmap is complete. Durable join-request queue listing, server-enforced rule acknowledgement versioning, moderator receipts/appeals, event RSVP reminders, quorum/result transparency, operator abuse queues, community export, and ownership transfer require confirmed database RPC contracts and authorization review before they can safely be shipped. No speculative RPC names, local-only substitutes, or unverified migration changes were added.

## Verification limits

Static checks do not replace live Supabase, multi-user permission, browser/device, TypeScript, lint, or production build tests. Those remain required under Node 24.15.0 with dependencies installed and suitable test credentials.
