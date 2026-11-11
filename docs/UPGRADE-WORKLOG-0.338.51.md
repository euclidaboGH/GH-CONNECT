# GreenHaven 0.338.51 — Run #288 Type-Safety and Release-Consistency Review

Date: 2026-11-11

## Changes

1. Exported `GHCContextType` from the canonical GHC context module so consuming hooks can use the actual context contract.
2. Removed the `as any` cast from `usePermissions` and allowed TypeScript to validate the context properties and action signatures.
3. Removed the redundant manual match-row annotation and derived IDs directly from the typed `matches` collection.
4. Bound `PermissionContext.currentUserId` to `profile.id` instead of hard-coding `current-user`; the permission engine retains its existing fallback while profile identity is not hydrated.
5. Added `scripts/check-run288-type-safety.mjs` with six release-contract assertions and registered it before the TypeScript check.
6. Reconciled package, lockfile, in-app release identity, README, source-of-truth and project-truth metadata to `0.338.51`.
7. Preserved Run #287's app-shell structural repair and existing financial, authentication, database, Testnet and Mainnet boundaries.

## Validation

- Run #288 type-safety contract: 8/8.
- Run #288 permission identity behavior: 5/5.
- Run #287 app-shell integrity: 20/20.
- Run #241 essentials: 20/20.
- Run #284 match-inbox privacy: 9/9.
- Run #284 single-owner message write: 5/5.
- Run #284 discovery privacy fallback: 6/6.
- Run #283 active-module wiring: 16/16.
- Run #278 communications: 31/31.
- Run #262 build-memory budget: 6/6.
- Run #263 essential hardening: 20/20.
- Run #266 social post experience: 14/14.
- Run #267 header and wallet authorization: 12/12.

## Outstanding validation and release limits

The workspace runtime is Node 22.16.0; the project requires Node `^24.15.0`, and locked dependencies also require Node 22.19.0 or newer. `npm ci --ignore-scripts --no-audit --no-fund` timed out twice before dependency installation completed. Therefore a dependency-backed full TypeScript check, lint, Next.js production build, browser/device acceptance and deployment are NOT claimed. No SQL migration, Testnet financial mutation, payment, GitHub push, Vercel deployment or Mainnet operation was performed. Production remains NOT APPROVED.
