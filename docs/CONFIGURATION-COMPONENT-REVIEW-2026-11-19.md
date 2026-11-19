# Configuration and component review — 0.338.106

**Date:** 2026-11-19  
**Reviewed source:** `GREENHAVEN-0_338_105-PHASE4-6-ACCEPTANCE-2026-11-19.zip`  
**Result:** targeted source corrections applied; no database, payment, provider, GitHub or deployment operations performed.

## Findings and changes

1. **`package.json` — corrected.** Removed an accidental root-level `verify:static` property. The actual `scripts.verify:static` command remains unchanged. Added a release-hygiene regression check so future package metadata cannot silently contain the stray key. Bumped the source patch identity to `0.338.106`.
2. **`package-lock.json` and `lib/app-release.ts` — synchronized.** Updated only the package/root lockfile version metadata and in-app release identity. Dependency declarations and resolved package versions were not changed; no claim is made that the outstanding npm audit findings are fixed.
3. **`.env.example` — expanded and clarified.** Added optional public/server-only variables used by the source, test-only inputs, operator keys, WebAuthn/Web Push, and database tooling; 163 project environment keys are now represented (platform-provided `CI`, `NODE_ENV`, `VERCEL`, `VERCEL_ENV` and `VERCEL_URL` remain platform-owned). Secrets remain blank; local-auth, memory fallback, payouts, A2U, optional services and E2E tests remain disabled by default. Clarified that `PI_ENV=production` selects the Pi Platform API mode and does not mean Pi Mainnet; Testnet is selected by `PI_NETWORK=testnet` together with `NEXT_PUBLIC_PI_SANDBOX=true`.
4. **`scripts/check-release-hygiene.mjs` — strengthened.** Added checks for script placement, duplicate environment declarations, and Pi Testnet/API-mode separation.
5. **`scripts/check-phase5-runtime-acceptance.mjs` and `scripts/check-run380-phase6-readiness.mjs` — corrected.** Their release-identity assertions now track the current source candidate rather than retaining a stale 0.338.105 literal.
6. **`middleware.ts` — comment corrected.** Clarified that inbound request IDs are untrusted correlation metadata; UUID syntax validation is not a trust or authorization boundary. Runtime behavior is unchanged.
7. **README and source-truth documents — synchronized.** Updated `README.md`, the bundle README, source-of-truth and project-truth records so 0.338.106 is the current package and 0.338.105 remains the parent/history. Regenerated the canonical migration inventory and `VERIFIED_MANIFEST.txt`.

## File-by-file review

| File / area | Review outcome |
|---|---|
| `.gitignore` | Correctly excludes dependencies, build/cache output, local env files and local archives; `.env.example` remains included. |
| `.nvmrc` | Pins Node `24.15.0`, matching `package.json` engine and CI runtime. |
| `components/` | Reviewed 214 TSX files. Nine raw image elements have `alt` attributes; all 22 `_blank` anchors include `rel`; the only `dangerouslySetInnerHTML` use renders locally generated QR SVG through `encodeQrSvg`. No evidence-supported component behavior patch was justified. Largest component is `marketplace-screen.tsx` (~205 KB); splitting it should follow measured bundle/runtime profiling, not a blind refactor. |
| `eslint.config.mjs` | Flat config extends Next Core Web Vitals; application components remain in lint scope. Generated/public/docs/scripts/Supabase sources are excluded by design. Dependency-backed ESLint was not run because `node_modules` is absent. |
| `middleware.ts` | Preserves edge-only research/field blocks, health response, correlation header propagation and same-origin mutation defense. Comment clarified; no policy behavior changed. |
| `next.config.mjs` | TypeScript/build errors are not ignored; image optimization remains explicit opt-in; production Webpack cache is disabled and build concurrency constrained for the known memory ceiling. |
| `package-lock.json` | Root package version and dependency coverage match `package.json`; no dependency graph changes made. |
| `postcss.config.mjs` | Correct Tailwind v4 `@tailwindcss/postcss` plugin configuration. |
| `.npmrc` | Retains the repository's legacy peer dependency install mode and lockfile behavior used by CI/Vercel. |
| `.vercelignore` | Excludes VCS, dependencies, build/cache/test artifacts, logs, archives and secret env files; only the non-secret example template is allowlisted. |
| `README.md` and `LATEST-PROJECT-BUNDLE-README.md` | Current release note, bundle identity and production limitations synchronized; historical RUN373–RUN375 details are explicitly labeled as historical. |
| `vercel.json` | Retains Next.js framework, cache cleanup/install/build commands, Pi-compatible CSP/frame allowlist, security headers and daily stale-hold cron. `unsafe-eval` remains a security-hardening candidate; it was not removed without a Pi SDK/browser acceptance test because prior project evidence identifies compatibility risk. |
| `tsconfig.json` | Strict, no-emit, bundler-resolution configuration retained; E2E tests remain outside the application typecheck scope. |
| `VERIFIED_MANIFEST.txt` | Regenerated and verified against 231 canonical SQL files: 122 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 106 REVIEW_REQUIRED. It is a repository inventory, not proof of remote application. |

## Verification

- Release hygiene: **20/20**; documentation hygiene: **PASS**.
- Project truth: **11/11**.
- RUN378 API route audit: **10/10**.
- RUN379 API hardening: **21/21**.
- RUN380 Testnet/Mainnet readiness: **12/12**.
- Phase 5 runtime harness guard: **15/15**.
- Run #305 quiet-premium interface: **12/12**.
- Phase 2 visual cohesion: **13/13**.
- Phase 1–10 upgrade pack: **20/20**; Phase 10 release closure: **17/17**; Phase 10 platform acceptance: **24/24**; Run #300 release integrity: **22/22**.
- Pass 48 accessible navigation: passed.
- Dependency-lock coverage: passed.
- Migration inventory / `VERIFIED_MANIFEST.txt`: synchronized, 231 files.
- Prebuild command discovery: **408 checks discovered** in dry-run mode; not executed as a complete prebuild suite.

## Remaining limitations

- Node available in this workspace is 22.16.0; project requires Node 24.15.0.
- Dependencies are not installed. Full `npm ci`, TypeScript, ESLint, Next production build and AST-based JSX duplicate-prop checks were not run.
- The previous dependency audit still has 22 findings (1 critical, 13 high, 6 moderate, 2 low); no registry-backed remediation was attempted.
- No real Pi Browser/Testnet two-account acceptance, mobile device sweep, performance profile, DB query-plan/concurrency benchmark or production CSP compatibility test was performed.
- Testnet remains NOT CERTIFIED; Mainnet remains NOT APPROVED. No deploy or live state mutation is authorized by this review.
