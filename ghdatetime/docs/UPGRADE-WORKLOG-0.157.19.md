# GreenHaven upgrade worklog — v0.157.19

Date: 2026-10-28

## Trigger

The v0.157.18 CI and Vercel runs exposed seven TypeScript errors across the wallet snapshot normalizer, Pi intent history UI, payment order metadata, and governance report parsing. GitHub Actions also warned that checkout/setup-node v4 still target Node 20 and that `ubuntu-latest` was moving to Ubuntu 26.

## Changes

- Replaced the wallet normalizer's broad `...amounts` spread with explicit required numeric properties so `WalletV2Snapshot` is fully typed.
- Typed the untrusted Pi intent list as `unknown[]` before normalization, avoiding implicit-any inference.
- Narrowed payment-order metadata to a non-array record, rejected malformed metadata, bounded order IDs and memo strings, and stopped accepting booleans or non-decimal strings for donation amounts.
- Narrowed governance report payloads before reading `communityId` and `id`, requiring bounded non-empty strings.
- Updated the CI workflow to `actions/checkout@v5`, `actions/setup-node@v5`, and `ubuntu-24.04` to address the reported Node 20 and runner-image warnings.
- Added `scripts/check-build-type-regressions.mjs` to the prebuild and static checks.
- Bumped package, lockfile, app release and active project metadata to `0.157.19`.

## Verification boundary

Source-only verification includes the focused regression guard and repository static checks. A full `tsc --noEmit`, lint, and Next.js production build could not be completed in the authoring environment because the available runtime is Node.js 22.16.0 (below the project requirement of Node.js 24.15.0 or newer) and dependency installation did not complete within the execution window. The Vercel npm `cache-dir` warning appears environment-injected rather than repository-configured; remove the corresponding custom Vercel environment variable/configuration after confirming its exact name. The reported 16 npm vulnerabilities, deprecated packages, and unapproved native install scripts are not claimed resolved; they require a fresh advisory-level audit under supported Node/npm. No live Pi, Supabase, or production operations were performed.
