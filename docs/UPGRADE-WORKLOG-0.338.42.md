# Run #279 — Ecosystem Social implementation start (0.338.42)

## Scope

Start implementation with the Social category while preserving every service's registered launch status. The Events service remains `COMING_SOON` and continues to route to the informational-only Coming Soon panel.

## Implemented in this slice

- Replaced category-only upgrade wording with service-specific contexts for all 41 registered services; each service now receives ten objectives grounded in its own function.
- Added a typed Events domain contract for organizer ownership, community association, visibility, lifecycle, time range, timezone, online/in-person location, and optional capacity.
- Added a side-effect-free event payload parser with bounded identifiers/title/description/location, strict lifecycle and visibility enums, valid chronological date ranges, HTTPS-only meeting URLs, and bounded integer capacity.
- Added an honest Events empty state; it explicitly says no events or RSVPs are fabricated and points users to Communities.
- Added contract tests for valid in-person/online records and invalid dates, oversized fields, unsafe URLs, missing locations, invalid capacity, invalid lifecycle, and empty-state honesty.
- Added the contract test to prebuild and static verification gates.
- Aligned package, lockfile, and in-app release version at `0.338.42`.

## Explicitly not enabled

- No Events UI route, event publishing, RSVP mutation, ticketing, event payments, or notification fan-out.
- No schema migration or SQL execution.
- No change to the 11 Active / 30 Coming Soon service statuses.
- No client-authoritative financial, entitlement, or payment behavior.
- No GitHub push or Vercel deployment.

## Verification

- `test:social-events-contract`: 15/15 checks passed.
- `check:ecosystem-ten-upgrade-coverage`: 15/15 checks passed; 41 services retain ten preparation tracks.
- Targeted Community transformation check exposed pre-existing release metadata drift in the 0.338.41 candidate (package 0.338.41 vs lock/app 0.338.40); this run aligns all three at 0.338.42. Re-run targeted regression gates after alignment.
- Full application build not run: dependencies are not installed in the working environment.
