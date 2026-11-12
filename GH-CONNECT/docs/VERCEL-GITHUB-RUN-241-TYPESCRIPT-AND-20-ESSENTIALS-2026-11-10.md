# Run #241 — TypeScript repair and 20 essential quality guardrails

Date: 2026-11-10  
Project baseline: 0.338.18  
Working version: 0.338.19

## Run #241 blockers repaired

1. `components/ghc/brand-logo.tsx`: removed the second explicit `loading`/`decoding` props from the dark-surface image. The shared image-props object remains the single owner of decoding, loading and fetch priority. This also restores the intended `priority` behavior for above-the-fold logo use.
2. `contexts/ghc-context.tsx`: added `mutedUsers` to the typed feed context contract. The provider already supplied this field; the consumer contract was incomplete.
3. `lib/design-system.ts`: removed the duplicate `layout.contentMax` key. The shell width remains `contentMax` (`--gh-shell-content-max`); the inner content width is now explicitly `contentWidth` (`--gh-content-max`).
4. `components/ghc/enhanced-feed-screen.tsx`: removed unnecessary `any` casts for blocked/muted settings and filtered IDs to non-empty strings before constructing the feed-ranking context.

## Twenty essential regression guardrails

The new `scripts/check-run241-essentials.mjs` validates 20 focused contracts covering:

- Logo: single-owner image props, LCP priority, lazy loading, reserved dimensions, meaningful alt text, decorative-image hiding and consistent dark/light behavior.
- Feed/privacy: typed muted-user exposure, provider value parity, muted-user ranking input, blocked-user settings merge, no unsafe muted-settings cast and correct ranking dependencies.
- Design system: unique shell-width token, distinct inner-content-width token and correct CSS-variable ownership.
- Feed UX/performance: accessible loading status, busy-state semantics, guarded feed-filter persistence and reduced-data preference initialization.

These are regression guardrails; they do not claim a full UI redesign or replace browser/device performance testing.

## Dependency and environment warnings

- `Unknown env config "cache-dir"`: CI already clears `npm_config_cache_dir` and `NPM_CONFIG_CACHE_DIR`; the warning also appears in Vercel's install environment. Remove the custom `cache-dir` environment variable from the Vercel project's Environment Variables (all applicable environments) and redeploy the preview. Do not add it to `.npmrc`.
- `isomorphic-dompurify@3.20.0`: deprecated due to incorrect semver/minimum Node metadata. A major-version move to 4.x needs an API/build compatibility check on Node 24.15.0 before changing the lockfile.
- `js-xdr`, `stellar-base`, `stellar-sdk`: transitive Stellar SDK deprecations. Migrating to `@stellar/*` requires tracing the upstream Pi/payment SDK dependency graph and validating signing/serialization compatibility; do not replace transitive packages with overrides.
- `eslint@9.39.5`: current major compatibility is tied to the installed Next.js 15 toolchain and flat config. Upgrade only as a tested Next/ESLint compatibility set, not by changing the lockfile version alone.
- `sodium-native` and `unrs-resolver` install-script warnings: review package provenance and platform need before allowlisting; do not blindly approve native install scripts.

## Safety boundaries

No payment, Pi SDK, wallet ledger, escrow, membership entitlement, reward, withdrawal, database migration, RLS, or production configuration was changed. No GitHub push, Vercel deployment, or Testnet/Mainnet operation was performed.

## Validation status

- `node scripts/check-run241-essentials.mjs`: 20/20 PASS.
- `node scripts/check-doc-hygiene.mjs`: pending in this working pass.
- `npm run typecheck`, full CI static verification, clean Node 24.15.0 install and production build: not yet run in this container. The available local runtime is Node 22.16.0 and the extracted archive does not include the complete dependency tree.
- Run #241's three reported TypeScript errors are corrected at source level; GitHub Actions is still required to confirm the complete project typecheck/build.
