# GreenHaven upgrade worklog — v0.157.20

Date: 2026-10-28

## Trigger

The v0.157.19 Vercel build reached TypeScript validation and failed because the wallet history pipeline's type predicate claimed that nullable `PiTransactionProjection` values were `PiIntentRow`. That predicate was invalid: the UI row type has optional fields, so it is not a subtype of the projection type required by a valid TypeScript type predicate.

## Changes

- Imported the canonical `PiTransactionProjection` type from the existing normalizer.
- Changed the null filter to the sound predicate `x is PiTransactionProjection`, which exactly matches the normalizer's output and narrows the mapped array to non-null projections before passing them to the wallet state setter.
- Updated the build regression guard to assert the canonical projection type is used, preventing a return to the incompatible `PiIntentRow` predicate.
- Bumped active package, lockfile, application release and project metadata to `0.157.20`.
- Preserved wallet history behavior: malformed and non-PI entries are still rejected by the normalizer and currency filter; no payment state or server authority is changed.

## Verification boundary

The focused source-level regression guard and repository static suite are run for this increment. A full `tsc --noEmit`, lint and Next.js production build must still be confirmed by CI/Vercel using Node.js 24.15.0 or newer. This patch does not claim that the previously reported npm cache-dir warning, 16 dependency advisories, deprecation notices or install-script warnings are resolved. Those require a fresh lockfile-specific audit and review of the Vercel project environment; no forced dependency upgrades or unverified install-script approvals are included.
