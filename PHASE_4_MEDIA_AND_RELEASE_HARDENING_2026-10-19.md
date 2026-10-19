# GreenHaven Phase 4 — Media and Release Hardening

**Status:** source-level hardening candidate; not deployed.

## Changes

- Media object names now use Node's cryptographic `randomUUID()` instead of `Math.random()`-derived names.
- The configured Supabase Storage bucket name is validated before it is interpolated into a storage URL. Invalid operator configuration fails closed with a stable error code.
- Client-supplied media metadata is validated as bounded non-negative integers. Width and height are limited to 20,000 pixels each; duration is limited to 12 hours. Invalid values return `INVALID_MEDIA_METADATA` rather than being silently coerced.
- Storage upload exceptions no longer echo raw exception text to the client. The server returns a stable user-safe message; detailed diagnosis must remain in protected server logs.
- Added `scripts/test-media-route-hardening.mjs` and wired it into `ci:verify`.
- Confirmed migration inventory generator remains synchronized with all 97 SQL files. The inventory is source-only and is not proof of any Supabase project's applied migration history.

## Regression checks run

- Media route hardening source checks: 12/12.
- Media upload compression source checks: 12/12.
- System announcement source checks: 15/15.
- Social authorization static scan: 38/38.
- IDOR static scan: 139/139.
- Migration inventory consistency: passed.
- Release hygiene: 10/10.

## Explicit limitations

- `node_modules` was absent in this worktree. A clean dependency installation, TypeScript typecheck, ESLint, production build, and browser/device tests were not run.
- No Git push, Vercel deployment, Supabase migration, or live Pi Testnet/Mainnet operation was performed.
- This phase does not change the current public-URL storage model. Configure `GH_MEDIA_BUCKET` to a bucket whose public/private access policy matches the product's intended media visibility; private-bucket signed delivery requires a separately reviewed end-to-end change.
- The metadata bounds are input sanity checks, not proof of media dimensions/duration; clients can still lie about metadata. The actual file signature and file-size/type limits remain server-validated.

## Deployment gate

Do not deploy solely on the static checks. First run `npm ci --legacy-peer-deps`, `npm run typecheck`, `npm run lint`, and `npm run build` in the supported Node environment. Then test upload, feed display, audience visibility, and media deletion/retention with at least two Testnet accounts and the configured bucket policy.
