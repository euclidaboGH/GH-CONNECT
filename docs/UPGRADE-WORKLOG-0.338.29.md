> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This Run #268 worklog is retained as historical evidence. Current implementation and maintenance authority is documented in `docs/SOURCE_OF_TRUTH.md` and the Run #269 worklog.

# GREENHAVEN 0.338.29 — release-truth and static-gate alignment

## Changes

1. Synchronized the legacy Phase 1–12 acceptance fixture's current-baseline markers with package release `0.338.29`. Its historical implementation notes and counts remain explicitly historical.
2. Synchronized the Phase 12 final-integration fixture's release marker with `0.338.29`; the production no-go and operator-acceptance requirements remain unchanged.
3. Added this release worklog so the request-boundary follow-up contract can verify that the source-only change and supported-runtime limitation are documented.

## Verification and limitations

- `scripts/check-phase1-10-upgrade-pack.mjs`: 20/20 passed against this archive.
- `npm run verify:static` was attempted in the available environment (Node.js 22.16.0). The project requires Node.js 24.15.0. The run exposed stale `0.338.27` markers in the two legacy fixtures and the missing release worklog; these are the documentation-only issues addressed by this increment. The full static suite must be rerun under Node.js 24.15.0 before treating the gate as passed.
- No dependency-backed typecheck, lint, Next.js production build, browser/device test, live Supabase/Pi test, deployment, migration application, or financial mutation is claimed by this worklog.
- Production remains NOT APPROVED until the documented runtime, database, provider, browser/device, operational, and explicit operator acceptance gates pass.

## Follow-up regression alignment

4. Updated the Phase 16 post-action toolbar's accessible name to describe Community curation while retaining the separate Respond to post group; synchronized its regression assertion.
5. Corrected the Phase 1 feed regression assertion to recognize the native semantic `<article>` element and the Enter/Space keyboard activation already implemented by the card.
6. Updated the Run #260 regression contract to accept the least-privilege `wallet_address` scope requested only inside the explicit wallet-consent gesture, and to compare release metadata against the current package version rather than hard-coding `0.338.27`.
7. Synchronized the Run #266 accessibility assertion with the updated Community curation toolbar name.

After these source/test-contract alignments, `npm run verify:static` completed successfully: **57/57 static gates passed** in the available Node.js 22.16.0 environment. This is source/static evidence only; it does not replace the required Node.js 24.15.0 dependency-backed prebuild, typecheck, lint, or production build.
