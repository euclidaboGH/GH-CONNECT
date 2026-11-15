# Run #299 — 20-point Vercel build remediation (0.338.63)

## Confirmed fixes

1. Removed the incompatible local `useGHCProfile()` structural cast in `components/ghc/profile-screen.tsx`.
2. Reused the canonical `GHCContextType` so `updateProfile(): Promise<boolean>` is represented accurately.
3. Preserved the hook's required-provider runtime guard.
4. Preserved the typed `Profile` model from the canonical context.
5. Preserved canonical friends/following collections without `unknown[]` shadow contracts.
6. Preserved the canonical `addToast` signature.
7. Removed the obsolete `no-console` suppression from `lib/client/debug-log.ts`.
8. Kept development-only `debugLog` gating.
9. Kept warning/error logging behavior unchanged.
10. Kept logger exception containment unchanged.

## Build and release hardening guards

11. Added a focused regression check for the exact Profile context mismatch.
12. Added a regression check against reintroducing the contradictory `Promise<void>` signature.
13. Added a regression check against unsafe context casts.
14. Added logger-policy regression checks.
15. Added package/lockfile version synchronization checks.
16. Added Node 24.15.0 runtime pin checks.
17. Added deterministic `npm ci` install-command checks.
18. Added unsupported npm `cache-dir` configuration cleanup checks.
19. Added Vercel upload exclusions and safe Webpack cache-cleanup checks.
20. Added a release-status guard ensuring source checks cannot silently approve production.

The 20 assertions are registered in the sequential prebuild suite through `scripts/check-run299-vercel-build-contract.mjs`.

## Footprint assessment

The supplied deployment log reports a 691 MB source footprint, but its five largest entries include the Vercel cache squashfs and duplicated Next.js SWC native modules. The repository's `.vercelignore` already excludes local `node_modules`, `.next`, caches, archives and local environment files. No source files or platform-native dependencies were deleted based on that aggregate number. A fresh deployment report is needed to distinguish Vercel's restored cache/dependency footprint from files actually uploaded as application source.

## Validation limits

The current execution environment is Node 22.16.0; the project requires Node 24.15.0 or later in the 24.x line. Therefore this run does not claim a dependency-backed typecheck, full ESLint run or Next.js production build. No dependencies were upgraded because the captured error is a source-level type mismatch and no dependency incompatibility was demonstrated. No migration, financial/provider action, GitHub push, Vercel deployment or production release was performed. Production remains NOT APPROVED.
