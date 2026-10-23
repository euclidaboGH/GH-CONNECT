# GREENHAVEN — PHASE 36 SECURITY, PRIVACY & ABUSE HARDENING V2

## Scope

Phase 36 establishes a durable security control plane and strengthens high-value mutation boundaries. The work is deliberately additive to existing authorization, privacy, RLS, payment, media, messaging, reputation, marketplace and Pi identity controls.

## Major upgrades

- Added durable multi-instance security rate-limit buckets.
- Added durable security audit events with actor/target/resource/correlation metadata.
- Added service-role-only SECURITY DEFINER RPCs for security state mutation.
- Kept security tables deny-by-default through RLS and revoked direct public/anon/authenticated access.
- Added durable rate limiting to Pi identity bootstrap, block and mute mutations, with safe in-process fallback when the database is unavailable.
- Added correlation IDs to security telemetry.
- Added non-blocking security audit events for Pi authentication outcomes and social block/mute mutations.
- Hardened verification-review secret comparison with timing-safe comparison.
- Preserved server-derived identity: client uid/ghUserId is not trusted for Pi authentication.
- Preserved HttpOnly/Secure/Partitioned production session-cookie policy from previous phases.
- Preserved existing server-authoritative ownership, privacy, RLS, payment, media and curation controls.

## Database contract

- 130 clean migrations.
- 114 executable GreenHaven tables.
- Canonical installer regenerated after the Phase 36 migration.

## Verification

- Phase 36 security checks: **19/19**
- Phase 35 GH Pulse/media: **17/17**
- Phase 34 reputation/curation: **18/18**
- Phase 33 community platform: **24/24**
- Phase 32 notifications/realtime: **20/20**
- Phase 31 messaging: **14/14**
- Phase 30 marketplace: **17/17**
- Project integrity: **36/36**, 0 errors, 0 warnings
- Migration release readiness: **PASS**
- Database source contract: **114 executable tables / 130 migrations**

## Runtime boundary

No claim is made for Next.js build/typecheck/lint, browser E2E, live Supabase execution, Vercel deployment, or Pi Testnet execution because the source workspace does not contain the required installed Node 24 dependency/runtime and live credentials. Those remain explicit Phase 41–42 gates.

## Remaining Phase 36 hardening targets

The next security sub-pass should continue auditing every mutating API route for centralized authorization, idempotency, body limits, origin/CSRF posture, ownership/IDOR protection, replay protection and abuse telemetry, then feed those findings into the Phase 40 regression fortress.
