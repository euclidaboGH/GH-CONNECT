# GH-CONNECT build fix — 2026-10-16 21:32 log

## Fixed
- Resolved TypeScript error in `contexts/ghc-context.tsx` where the post-edit workflow broadcasts `kind: "edit"` but `PostEngagementDetail.kind` did not allow that value.
- Updated `lib/engagement/post-engagement.ts` to include `"edit"` in the event-kind union. This preserves the existing post-edit engagement broadcast rather than deleting the event.

## Remaining warnings to address separately
- `Unknown env config "cache-dir"`: remove the unsupported `cache-dir` npm environment/config entry in Vercel or the build environment. It is not set in this repository's `.npmrc`.
- `isomorphic-dompurify@3.20.0` deprecation warning: the project declares Node `^22.22.2 || ^24.15.0`; review and update the package/lockfile together to a supported compatible release. Do not change only `package.json` without regenerating `package-lock.json`.
- `eslint@9.39.5` unsupported/deprecated warning: upgrade only with a compatible `eslint-config-next` / Next.js combination, then run lint and production build.
- `12 vulnerabilities`: review with `npm audit` and apply compatible targeted fixes; avoid `npm audit fix --force` without reviewing breaking changes.
- `unrs-resolver` install-script notice: review npm's install-script policy and approve only if the dependency is trusted and the build requires its postinstall script.

## Validation
- The reported build failure was a TypeScript union mismatch. This archive includes the targeted source fix; a fresh Vercel build is still required to validate the complete deployment and surface any subsequent errors.
