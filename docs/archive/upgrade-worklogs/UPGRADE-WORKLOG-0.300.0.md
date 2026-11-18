# GreenHaven v0.300.0 — Phase 14 Worklog

Date: 2026-11-04

## Implementation

- Added full-screen pre-publish image previews to the post composer using the shared media lightbox.
- Added inline video playback controls for post attachments using `DurableVideo`, which resolves private media facade references through the existing viewer-authorized URL path.
- Added full-screen Story photo preview and inline Story video playback before publishing.
- Kept upload, persistence, publish, audience and authorization behavior in the existing compose/domain pipeline.
- Added a dedicated Phase 14 source contract and registered it in `prebuild` and `verify:static`.
- Updated package, lockfile, app release, source-of-truth documentation and migration manifest metadata.

## Verification

- Phase 14 creator media preview source gate: 10/10.
- Phase 13 Stories/profile media regression: 13/13.
- Release hygiene: 11/11.
- Project truth: 10/10.
- Documentation hygiene: passed.
- Node.js runtime observed in this environment: 22.16.0. The repository requires Node.js 24.15.0 (`^24.15.0`). TypeScript, lint and Next.js production build were not validated under the required runtime.
- Browser, Pi Browser, mobile-device, private-media live authorization and end-to-end publish acceptance remain pending.

## Safety boundary

No database migrations, storage policies, authentication rules, wallet balances, GHC ledger, Pi payments, marketplace payment contracts or financial records were changed. The migration inventory remains source-only evidence and does not prove remote migrations are applied.
