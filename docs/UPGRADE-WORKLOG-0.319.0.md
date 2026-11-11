# Upgrade worklog — 0.318.0

## Phase 6 — Profile and Identity performance completion

- Completed per-domain relationship index caching, immutable-array invalidation and batch hydration.
- Added account-switch cancellation and stale-response rejection to profile timeline pagination.
- Hardened identity overview hydration with canonical identity subscription, abortable parallel requests, latest-request-wins checks and prior-account counter clearing.
- Dedicated checks: relationship runtime 16 assertions; Phase 6 static contract 20/20.

## Phase 7 — Premium Profile Identity Experience

- Added semantic accessible reputation progress, locale-formatted metrics, announced loading state and last-known-good retry feedback.
- Added a dedicated Phase 7 source gate and registered it in both `prebuild` and `verify:static`.
- Dedicated Phase 7 source contract: 9/9.

## Consolidated verification and limitations

This release has source-only verification evidence; it is not production acceptance.

- `verify:static` passed on the supplied environment before the final Phase 7 UI increment. Rerun is required after this increment.
- `prebuild` was attempted; the explicit runtime gate stopped it because this environment provides Node 22.16.0 while the repository pins Node 24.15.0.
- `npm ci`, TypeScript, ESLint and Next.js production build remain unverified. No claim of production readiness is made.
- No migration was added or applied; canonical migration count remains 186. No financial or blockchain execution authority changed.


## Phase 7 — Creator, Business Identity and Portfolio (0.319.0)

- Integrated responsive professional/business identity showcases into owner and read-only public profile surfaces.
- Added bounded services, skills, experience and visual portfolio previews; HTTPS-only project/media URLs reject credentials and unsafe schemes.
- Added authenticated achievement hydration with duplicate suppression, account-switch cancellation and honest durability disclosure.
- Added public professional-interest signals to explainable discovery relevance.
- Dedicated Phase 7 identity showcase contract: 13/13; professional/business sanitizer and public-profile privacy runtime tests: 16 assertions each.
- The consolidated static suite initially exposed stale package/lock/release-truth metadata in 32 checks. Metadata was synchronized without changing dependency versions or migration contents; final consolidated static verification passed 57/57.
- Supported Node 24.15.0 typecheck, lint, full prebuild and production build remain outstanding in this Node 22.16.0 environment. No migration or financial authority change.
- Added server-side whitelisting and bounds for professional/business profile payloads; client-submitted verification flags are discarded. Public people discovery omits hidden/matches-only profiles and applies location/interests visibility preferences before returning identity extensions.
