# Upgrade worklog — 0.338.97 / Run 315

Date: 2026-11-17

## Scope
Repair the supplied GitHub Actions lint/build failures and all directly related warnings and artifact diagnostics.

## Changes

1. Replaced raw internal anchors in the public research form with Next.js `Link` components.
2. Removed two invalid ESLint suppression directives that referenced an unavailable rule.
3. Added the missing `state.posts` dependency to the comment-deletion callback.
4. Restored the shared section-title class in the reusable heading component.
5. Corrected the stale Pass 14 release-version assertion.
6. Updated the Pass 14 shared-heading contract to match the design system.
7. Added a deterministic CI failure-context file before diagnostics artifact upload.
8. Added a nine-assertion regression gate for all Run 315 fixes.
9. Registered the new gate in prelint, prebuild and static verification.
10. Synchronized release metadata and documented the remaining runtime/build acceptance limits.

- `components/field/public-research-form.tsx`: use Next.js `Link` for internal home and privacy navigation.
- `lib/secure-id.ts`: remove two invalid ESLint suppression directives referencing an unavailable `@typescript-eslint/no-require-imports` rule. Keep cryptographic random generation and fail-closed behavior.
- `contexts/ghc-context.tsx`: declare `state.posts` in `deleteComment` dependencies.
- `components/ghc/section-heading.tsx`: emit the shared `gh-section-title` design-system class.
- `scripts/check-pass14-product-design.mjs`: remove stale 0.236.0 wording and validate current package/release synchronization.
- `.github/workflows/ci.yml`: create a deterministic failure-context file before uploading Next diagnostics, preventing empty-artifact warnings when Next exits before creating `.next` output.
- Add `scripts/check-run315-ci-lint-fixes.mjs` and register it in `prelint`, `prebuild:checks`, and `verify:static`.
- Synchronize package, lockfile, app release, README, verified manifest and current project metadata to 0.338.97.

## Verification

This is a source-only verification scope; dependency-backed lint/build and device acceptance remain outstanding.
- Run 315 source regression gate: 9/9.
- Pass 14 product-design gate: 8/8.
- Run 314 screen-experience gate: 15/15.
- Run 313 transaction coordinator source gate: 8/8.
- Release hygiene: 17/17.
- Project truth: 11/11.
- JSX safety: 1,154 files.
- Full `npm run verify:static`: passed.

## Not performed / remaining
- Workspace has no installed dependencies; ESLint, TypeScript and Next production build were not run locally.
- Workspace Node is 22.16.0; project requires Node 24.15.0.
- No GitHub push, Vercel deployment, Supabase mutation, migration application, wallet/payment/payout operation or Mainnet action.
- Production remains NOT APPROVED pending Node 24.15.0 CI, production build, DB reconciliation and browser/device acceptance.
