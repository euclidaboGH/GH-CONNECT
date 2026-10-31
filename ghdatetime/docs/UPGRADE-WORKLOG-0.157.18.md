# GreenHaven upgrade worklog — v0.157.18

Date: 2026-10-28

## Trigger

Vercel build at commit `d42badf` failed during TypeScript validation because `parsed.value.entry` is untrusted JSON and TypeScript correctly would not permit direct access to `communityId` or `action`.

## Changes

- Narrowed `entry` to a non-null, non-array object before field access.
- Validated `communityId` and `action` as non-empty strings with explicit maximum lengths; validated optional `id` as a bounded string.
- Returned the existing `invalid_entry` 400 response for malformed values.
- Added `scripts/check-governance-moderation-log-input.mjs` to the prebuild contract checks.
- Bumped package, lockfile, app release and current project metadata to `0.157.18`.
- Preserved honest durability semantics: the route still returns `durable: false` until persistent storage is implemented and verified.

## Verification boundary

Source-only verification for this increment consists of repository static checks and ZIP integrity validation. A full Next.js production build, lint and full TypeScript check must still be confirmed by Vercel or an environment using the project's supported Node.js 24.15.0-or-newer runtime and installed dependencies. The npm warnings from the supplied Vercel log (unknown `cache-dir`, vulnerable/deprecated dependencies, and unapproved install scripts) are separate issues and are not claimed resolved by this type-safety fix. Do not use `npm audit fix --force` without reviewing the specific advisories and compatibility impact.
