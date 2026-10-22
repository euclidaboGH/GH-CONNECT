# GH-CONNECT Vercel Build Failure Repair — 2026-10-22

## Reported failure

Vercel deployed commit `aeb1c8a` and compiled the Next.js production bundle, then stopped at TypeScript validation:

- `app/api/media/[id]/signed-url/route.ts`: `asset.storagePath` possibly undefined.
- The preceding GitHub Actions run also reported `PostRow.archived_at` missing from `lib/server/social/post-visibility.ts` while the query selected that field.

## Changes in this candidate

1. Add `archived_at: string | null` to `PostRow`, matching the canonical query shape.
2. Treat the media authorization RPC/fallback payload as untrusted at the point of use. Validate `ownerId`, `bucket`, and `storagePath` after either data source has assigned `asset`.
3. Reject empty, absolute, owner-mismatched, traversal, dot-segment, and empty-segment storage paths before signing.
4. Encode the bucket and each validated storage path segment before constructing the Supabase Storage signing request.
5. Add `scripts/test-latest-ci-regressions.mjs` checks and wire them into `ci:verify`.

## Verification actually performed

- `node scripts/test-latest-ci-regressions.mjs`: 8/8 passed.
- `node scripts/test-payment-economy-stabilization.mjs`: 24/24 passed.
- `node scripts/test-critical-security-hardening.mjs`: 20 assertions passed.
- The candidate's ZIP archive passed integrity verification before this repackaging.

## Not yet verified

The complete `npm run typecheck`, lint, and production build have **not** been executed successfully in this environment. The local runtime is Node.js 22.16.0 while the project `.nvmrc` requires Node.js 24.15.0; dependency installation did not complete. Therefore this report does not claim the Vercel build is green. Verify with Node 24.15.0 and a clean `npm ci --legacy-peer-deps`, then run `npm run typecheck`, `npm run lint`, and `npm run build` before merging.

## Other Vercel log warnings

- `Unknown env config "cache-dir"`: inspect Vercel project environment variables and remove/rename any custom `npm_config_cache_dir`/`NPM_CONFIG_CACHE_DIR` setting if present; do not guess at or delete unrelated settings.
- 19 npm audit findings (2 low, 1 moderate, 16 high): run `npm audit --json` on the exact lockfile and review each dependency path. Do not run `npm audit fix --force` blindly.
- Install-script approval warnings for `sodium-native` and `unrs-resolver`: review package provenance and expected build behavior before approving scripts.
- Deprecation notices are not the cause of this TypeScript failure.

## Release safety

This candidate is based on the previously available GH-CONNECT 0.69.3 archive, not a fresh checkout of the live `testnet` branch at `aeb1c8a`. Apply the focused patch to the actual current branch and inspect the diff before committing. Do not replace the branch wholesale with this archive. No Supabase migrations or live payment/ledger data were changed.
