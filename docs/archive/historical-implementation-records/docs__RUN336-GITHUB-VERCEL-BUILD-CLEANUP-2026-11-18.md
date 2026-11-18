# RUN336 — GitHub / Vercel build cleanup (2026-11-18)

**Package:** `gh-connect@0.338.99`  
**Parent:** RUN335 election tally type-narrowing candidate  
**Status:** source-only cleanup candidate; not pushed, not deployed; production remains NOT APPROVED.

## Corrections from the supplied GitHub Actions typecheck log

1. Election tally request counts are parsed through explicit required-count and optional-count normalizers. Optional counts resolve to `number | null | "invalid"`; invalid values are rejected before comparison. Required vote counts are explicitly assigned `number` after validation. Existing safe-integer, non-negative, maximum-count, candidate-total, registered/accredited-voter and ballot-total checks remain.
2. `components/app-wrapper.tsx` imports `isPublicRoutePath` from the canonical `lib/routing/public-route-policy` module.
3. The field-agent assignment UI model includes the server-returned `assignmentId` used by the own-assignment acceptance endpoint.
4. Communities imports `useRef` from React.
5. Communities member preview uses the already-computed `joined` decision instead of reading the nonexistent `selected.isJoined` property.
6. `safeCommunityCountTotal` supplies an explicit `number` generic to `reduce`, avoiding an `unknown` accumulator.
7. Research Studio loader callbacks and their effects include the required callback dependencies. No `react-hooks/exhaustive-deps` suppression was introduced.
8. The outdated Phase 4 source assertion now checks the resolved `joined` membership decision, matching the real component model and preserving the rule against inventing names from opaque user IDs.

## Regression gates

- `scripts/check-run336-build-cleanup.mjs`: 12/12; registered in static, prebuild, pretypecheck and prelint gates.
- Prebuild manifest dry-run enumerates 392 checks; this is enumeration only, not an execution claim.
- Updated RUN335 tally type-narrowing gate: 8/8.
- Election tally UI source gate: 13/13.
- Election reconciliation runtime tests: 6/6.
- Phase 4 identity/community/messaging gate: 32/32.
- Full `npm run verify:static`: PASS.

The supplied seven TypeScript diagnostics are no longer present in the source. A full dependency-backed `tsc --noEmit`, ESLint run and `next build` could not be certified in this packaging environment because `node_modules` is intentionally absent and the available Node runtime is 22.16.0 while the project requires `^24.15.0`. Running global `tsc` without dependencies produces missing-module/JSX-type diagnostics and is not a valid full project typecheck.

## Dependency warnings — deliberate non-changes

- `isomorphic-dompurify@3.20.0` is deprecated upstream because the Node engine floor was raised without a major-version bump. Its 4.x replacement is available, but package-lock regeneration and the sanitizer test suite require a registry-connected Node 24.15.x environment. Do not hand-edit lockfile integrity metadata.
- `js-xdr`, `stellar-base`, and `stellar-sdk` are transitive dependencies of the official, integrity-pinned `pi-backend@0.1.3` SDK. They were not replaced or overridden: Pi A2U payment execution depends on this exact SDK contract. A safe cleanup requires an officially compatible Pi SDK release and Testnet payment/receipt regression testing.
- ESLint `9.39.5` is now upstream EOL. The project remains on Next 15.5.26 / eslint-config-next 15.5.26, whose plugin compatibility with ESLint 10 must be verified before changing the major linter. No `--force`, `--legacy-peer-deps`, or unverified override was used. Plan a coordinated Next 15 patch/config and ESLint 10 compatibility update on Node 24.15.x.

These are dependency maintenance warnings, not the TypeScript errors from the supplied log. They are documented rather than hidden or force-overridden.

## GitHub Desktop handoff

This ZIP contains the complete project source at its root but intentionally excludes `.git`, `node_modules`, `.next`, `.vercel`, local environment files, logs and caches. To update an existing GitHub Desktop clone:

1. Back up or commit any local uncommitted work in the existing clone.
2. Extract this archive to a temporary folder.
3. Copy the extracted project contents into the existing cloned repository folder, allowing the corrected files to replace their old counterparts. Do not delete the clone's `.git` folder.
4. Keep your real `.env.local` outside the archive and never commit secrets. Use `.env.example` only as a template.
5. Open GitHub Desktop, review the changed-file list and diff, then commit and push to the intended branch.
6. After pushing, let Vercel run the Preview build with Node 24.15.x. Do not approve Production from static checks alone.

## Unchanged safety boundaries

No GitHub push, Vercel deployment, Supabase migration, Testnet/Mainnet data mutation, payout, reward, membership, election result or financial operation occurred in RUN336. Mainnet remains untouched. The three previously held research/media/evidence migrations remain held. Production remains NOT APPROVED.
