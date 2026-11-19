# RUN372 — Field Research hard disconnection

**Date:** 2026-11-19  
**Baseline:** `GREENHAVEN-0_338_100-RUN371-PI-CDN-SANDBOX-AUTH-FIX-2026-11-19.zip`  
**Package:** `gh-connect@0.338.101`  
**Scope:** Temporarily disconnect Field Research / Research Studio and its API surfaces without deleting its source or changing its database state.

## Changes

1. Changed the canonical `field-research` ecosystem service to `UNAVAILABLE` with `destination: { kind: "none" }`. It is no longer featured or interactive; the directory communicates that it is temporarily disconnected.
2. Removed the dedicated client navigation branch that previously sent users directly to `/field/studio`.
3. Added an edge middleware kill switch for every `/api/research/**` and `/api/field/**` request. It runs before route handlers and returns a no-store HTTP 503 response with the stable code `FIELD_RESEARCH_TEMPORARILY_DISABLED`, a correlation ID and `Retry-After`.
4. Added a non-disclosing no-store HTTP 404 for `/field`, `/field/**`, `/r`, and `/r/**`, including public share links, before any page handler renders.
5. Expanded the middleware matcher to include the disabled page routes as well as APIs.
6. Removed Field Research and public research links from the public-route allowlist; robots policy disallows indexing `/field` and `/r`.
7. Kept the source implementation, SQL migrations, migration classifications, evidence code and historical records intact for a controlled future re-enable. No schema, data, storage object, user submission or migration state was modified.
8. Added and registered the RUN372 hard-disconnection regression gate. Updated route-boundary and service-registry tests to reflect the deliberate suspension.
9. Incremented the package patch version to `0.338.101` and synchronized the package lock root metadata. Dependency versions and package integrity data were not changed.

## Isolation behavior

- Browser routes under `/field` and `/r` are blocked before the Next.js page route executes.
- API routes under `/api/research` and `/api/field` are blocked before their route handlers execute. They cannot invoke Research/Field database access, storage, evidence scanning or provider logic through HTTP.
- Other application routes and APIs do not match the kill-switch prefixes and continue through the existing middleware flow.
- The Research service is rejected by the canonical server-side ecosystem release helper because its registry status is `UNAVAILABLE`.
- Research source and migrations are retained; this is a reversible operational suspension, not a destructive removal.

## Verification

- RUN372 hard-disconnection checks: 8/8 PASS.
- RUN342 Pi authentication scope / research public-route isolation checks: 6/6 PASS.
- Public route boundary checks: 12/12 PASS.
- Ecosystem service registry: 42 services, 10 categories, 11 Active, 30 Coming Soon, 1 Unavailable; PASS.
- Ecosystem 30-track coverage: 15/15 PASS.
- The RUN372 gate is registered in `verify:static`, `prebuild`, `pretypecheck` and `prelint`.

## Explicit limitations

This change isolates the runtime route surface. The retained Research/Field source files are still part of the repository and may still be parsed/typechecked or bundled by general build tooling; therefore this is not a claim that all research-related source has been physically removed from the build graph. The full supported Node 24 dependency-backed typecheck, lint, production build, and live Testnet browser verification remain separate gates. The archive has not been deployed or pushed.

## Database and deployment safety

No migration was applied, reverted or reclassified. Existing `APPLIED`, `REVIEW_REQUIRED` and other migration records remain unchanged. No Supabase writes, GitHub push, Vercel deployment, Mainnet activation, payment, wallet, reward, membership or financial operation was performed. Production remains NOT APPROVED.
