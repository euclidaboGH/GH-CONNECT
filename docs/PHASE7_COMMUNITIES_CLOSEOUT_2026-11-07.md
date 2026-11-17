# Phase 7 — Communities transformation closeout (source release 0.330.32)

## Delivered in this source release

- Server governance repository backed by the Supabase service-role REST API.
- Authenticated moderator-only reads for moderation history and reports.
- Authenticated actor identity is resolved on the server; client-supplied actor IDs are never authoritative.
- Moderation writes call a database RPC that rechecks the active moderator role in the same transaction as the append.
- Report creation and report resolution use the existing server-side governance RPCs; API success is returned only when the RPC reports success.
- Moderator hub hydrates durable history and report queues from server endpoints, retaining session data only as a fallback when server reads are unavailable.
- Database migration adds indexes, deny-by-default client RLS, service-role-only access and the transactional moderation append RPC.
- Community tabs and key controls use 44px minimum touch targets; the content region is keyboard focusable and named; reduced-motion preferences are respected.
- Existing discovery, pending-join/invitation, onboarding, discussion, event, resource and chat participation flows remain in place.

## Required deployment configuration

The durable server path remains deliberately opt-in until the migration has been reviewed and applied to the intended environment:

- `SUPABASE_URL` — server-only Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only service-role secret; never expose as a `NEXT_PUBLIC_*` variable.
- `GHC_GOVERNANCE_SERVER=1` — enables client mutation mirroring to the durable governance endpoints.

The moderator hub reads the server endpoints and labels the history server-backed only after a successful authenticated durable response. API/database failures return an error and do not claim durable success.

## Migration handling

`supabase/migrations/20261107170001_phase7_durable_community_governance.sql` is classified `REVIEW_REQUIRED` in the source manifest and Testnet apply guide. It has **not** been applied by this source-code change. Review schema compatibility and function grants, apply to a disposable database/Testnet first, verify role boundaries and concurrent role changes, then reconcile the actual environment migration history. Do not infer applied status from the repository.

## Verification boundary

Static contracts and the Phase 7 discovery/normalization runtime tests are included in the project gates. Full Next.js production build, browser/screen-reader/mobile-device acceptance, and live Supabase RLS/RPC verification still require Node.js `24.15.x`, installed dependencies, a configured Testnet database and real device/browser testing. This archive does not claim those external checks have passed.
