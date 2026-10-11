# GH-CONNECT Vercel build fixes

Applied to the supplied project archive:

- Fixed the JSX conditional in `components/ghc/message-screen.tsx` by wrapping the conversation count and list in a React Fragment.
- Corrected the notification Escape close event to use the existing `escape` reason in `lib/transient-ui.ts`.
- Fixed the wallet-fetch effect dependency in `components/ghc/profile-ecosystem-hub.tsx` so it refetches when the effective user ID changes.
- Memoized the profile fallback in `components/ghc/profile-screen.tsx` to stabilize memo dependencies.
- Removed two obsolete `@next/next/no-img-element` suppression comments from `components/ghc/marketplace-screen.tsx` because the rule is already configured off.
- Scoped the Next.js ESLint plugin config to source/config JavaScript and TypeScript files to help Next.js 15 detect the plugin with ESLint flat config.

## Checks run

- `node scripts/check-jsx-safety.mjs` — passed (601 files scanned).
- `node scripts/scan-production-safety.mjs` — passed (21 checks, 0 failures).

A complete `npm ci`/`next build` could not be completed in this environment because dependency installation stalled before packages were available. Therefore this archive is not represented as having passed a full production build.

## Dependency warnings still requiring a fresh audit

The supplied lockfile reports 12 vulnerabilities and warnings for `isomorphic-dompurify`, `recharts`, `eslint`, and the `unrs-resolver` install script. These were not blindly force-upgraded: doing so without a working install/audit and build could introduce breaking changes or produce a mismatched lockfile. After installing dependencies in a network-enabled environment, run `npm audit`, review each advisory, update dependencies with a regenerated `package-lock.json`, then run `npm run ci:verify` and a fresh Vercel deployment.

No Supabase migration files were changed. No `.env*`, `node_modules`, `.next`, or `.git` directories are included in the project archive.
