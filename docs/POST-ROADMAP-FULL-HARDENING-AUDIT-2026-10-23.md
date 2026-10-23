# GreenHaven Post-Roadmap Full Hardening Audit — 2026-10-23

## Scope
Full source review after Phases 39–44, driven by the real Vercel Testnet build at commit `f70c0cc` on Node 24.22.1 / Next.js 15.5.26.

## Real Vercel evidence received
- `npm ci --legacy-peer-deps`: completed on Vercel.
- Next production compilation: completed successfully.
- Build failed during lint/type validation.
- Reported blockers: direct-post `commentCount` DTO drift, unified notification contract drift (`requestId`, retired `entityId/entityType`), obsolete Marketplace `EmptyState` props, and a Profile identity hook dependency warning.
- npm reported 19 dependency vulnerabilities (1 low, 16 high, 2 critical). Exact advisory graph was not present in the supplied log.

## Repairs applied
1. Direct post DTO now explicitly carries `commentCount`; Feed hydration consumes that typed API contract instead of asserting a bare `Partial<Post>`.
2. Notification Bell now uses the unified inbox contract (`sourceId/sourceType`, metadata, correlation/request IDs). The duplicate retired social mapper using `entityId/entityType` was removed, reducing both type drift and duplicate-notification risk.
3. Unified notification response typing now includes `requestId`, matching the server row contract.
4. Marketplace empty state now uses the canonical `action: { label, onClick }` component API.
5. Profile identity refresh now uses a stable callback and an in-flight ref. This fixes the hook warning without introducing a loading-state callback/effect loop; the latest `onCounts` callback is held in a ref.
6. Added `scripts/test-post-roadmap-hardening.mjs` and wired it into `ci:verify` so these exact regressions cannot silently return.

## Audit observations
- 131 canonical migrations and 114 executable GreenHaven tables remain unchanged.
- Phase 39 backend convergence remains 26/26.
- Phase 40 regression fortress remains 50/50.
- Phase 44 final release audit remains 31/31.
- Project integrity remains 36/36 with zero errors/warnings.
- No TODO/FIXME/HACK/XXX markers were found in app/components/lib/contexts/hooks.
- There are still broad historical compatibility/type-debt areas (`as any`, legacy labels, localStorage usage). These are not automatically defects: many localStorage uses are UI/session preferences, and historical/compatibility references must not be deleted without consumer/runtime proof. They should be reduced incrementally behind tests rather than mass-deleted.

## Dependency security
The Vercel install reported 19 vulnerabilities. This package does **not** run `npm audit fix --force` because that can introduce breaking dependency changes, including the Pi SDK graph. The local audit endpoint was unavailable in the packaging environment, so the exact advisory dependency paths could not be reproduced here. Before production release, run `npm audit --json` in the same Node 24 environment, classify direct vs transitive findings, update direct dependencies with lockfile regeneration, and rerun the Pi SDK lock verifier + full production build. `isomorphic-dompurify@3.20.0` is also deprecated under the Vercel install output and should be evaluated for a controlled 4.x upgrade in that dependency-remediation pass.

## Verification boundary
The supplied Vercel log proves Node 24 install and production compilation. It does **not** prove this repaired package now passes the full Vercel build because the repaired commit has not yet been deployed. The next authoritative check is to push this package to `testnet` and let Vercel run the same Node 24 build again. Any newly exposed compiler error should be fixed at its contract source, not suppressed with `any`, ignored TypeScript errors, or disabled lint rules.
