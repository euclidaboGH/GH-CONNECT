# Vercel / GitHub withdrawal JSX repair and UX hardening — 2026-11-10

## Release baseline

- Package baseline remains `0.338.18`.
- This is an in-place repair of the supplied project archive; no rewrite, deployment, database migration, payment-policy change, or production approval is included.

## CI failure repaired

`components/ghc/pi-withdraw-sheet.tsx` rendered two sibling elements directly in the `needsConsent` branch of a nested conditional. The identity details panel and consent panel are now grouped in a JSX fragment, restoring valid TSX without adding a DOM wrapper or changing the consent / payout authorization flow.

The Phase 28 wallet-consent static gate now checks that this conditional branch retains the fragment wrapper and that the accessible UX contracts below remain present.

## Ten essential UX hardening improvements

1. Keep identity details and the consent panel in a fragment, preserving the existing layout without an extra DOM node.
2. Give the GreenHaven / Pi identity details a named accessible group.
3. Announce payout-consent loading through a polite status region.
4. Expose the consent panel's authorization-in-progress state with `aria-busy`.
5. Prevent authorization submission while identity status is still loading.
6. Expose the authorize action's busy state to assistive technology.
7. Declare the withdrawal PIN's six-digit numeric pattern and numeric input mode.
8. Associate PIN status failures with the PIN input using `aria-describedby`.
9. Expose fee-quote progress with `aria-busy`.
10. Expose withdrawal submission / PIN processing progress with `aria-busy`.

The existing server-side consent proof, durable identity mapping, exact-amount quote requirement, PIN fail-closed behavior, and service-role-only grant boundary remain unchanged.

## Verification performed

- TypeScript `transpileModule` syntax parse of `pi-withdraw-sheet.tsx`: 0 diagnostics.
- Phase 28 wallet-consent static contract: 35/35.
- Phase 28 wallet-consent runtime contract tests: 9/9.
- JSX safety scan: 1,033 files scanned, passed.
- Performance RUM contract: 17/17.
- Feed controls / performance contract: 29/29.
- Settings performance contract: 14/14.
- Independent domain hydration contract: 9/9.
- Experience quality contract: 9/9.
- Resilience contract: 8/8.

## Remaining environment / dependency warnings

- The supplied CI log's TS1005 / TS1382 / TS1381 JSX parser errors are addressed by the fragment repair.
- The local verification container only has Node `22.16.0`; the project pins Node `24.15.0`. A full `npm run typecheck` / production build was therefore not represented as passing here. The attempted dependency install did not complete within the available execution window.
- `npm warn Unknown env config "cache-dir"` is not configured in the repository `.npmrc`; the existing dependency review identifies the Vercel project environment (`NPM_CONFIG_CACHE_DIR` / `npm_config_cache_dir`) as the place to remove the obsolete setting.
- The Stellar package deprecations and ESLint support warning require a compatibility-tested dependency migration. No blind major-version or transitive package override was applied.
- `sodium-native` and `unrs-resolver` install-script approvals were not broadened without validating their necessity and provenance.
- Dependency audit advisories require a fresh completed audit on the supported Node/npm runtime. No `npm audit fix --force` was run.

## Release posture

Static and focused regression checks above passed. Full supported-runtime typecheck, Vercel build, dependency audit, and live Pi Testnet / Supabase acceptance remain required before treating this release as deployment-ready. Production remains NOT APPROVED.
