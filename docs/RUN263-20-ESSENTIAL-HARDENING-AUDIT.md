# Run #263 — 20 essential GREENHAVEN hardening controls

Date: 2026-11-10. Scope: authoritative source 0.338.27, both connected Vercel projects, Supabase Testnet, and a read-only status check of Supabase Mainnet.

| # | Essential control | Result | Evidence / action |
|---:|---|---|---|
| 1 | Build worker memory ceiling | FIXED IN SOURCE | Next.js worker concurrency limited to one. |
| 2 | Webpack memory pressure | FIXED IN SOURCE | `webpackMemoryOptimizations` enabled. |
| 3 | TypeScript bypass protection | VERIFIED | `ignoreBuildErrors: false`; CI typecheck retained. |
| 4 | Lint bypass protection | VERIFIED | `ignoreDuringBuilds: false`; CI lint retained. |
| 5 | Node runtime drift | VERIFIED | `.nvmrc`, package engine and CI pin Node 24.15.0. |
| 6 | Reproducible dependency install | VERIFIED | npm lockfile v3 and clean `npm ci` in CI/Vercel. |
| 7 | Build regression coverage | ADDED | Run #263 adds 20 source/CI assertions and joins prebuild. |
| 8 | GitHub Actions privilege scope | VERIFIED | Workflow repository permission is read-only. |
| 9 | Database schema deployment guard | VERIFIED | CI does not automatically push or replay Supabase migrations. |
| 10 | Public schema RLS coverage | VERIFIED LIVE | 140 public tables; none found with RLS disabled. |
| 11 | Privileged database RPC exposure | VERIFIED LIVE | Zero public SECURITY DEFINER functions executable by anon/authenticated. |
| 12 | Broad public write policies | VERIFIED LIVE | No broad `USING true` / `WITH CHECK true` write policy found. |
| 13 | Deny-by-default tables | REVIEWED | 13 RLS-enabled tables have no policies; preserve fail-closed behavior until domain owners approve access. |
| 14 | Public read policy data minimization | REVIEW REQUIRED | Two broad SELECT policies: `ghc_public_identities` and `ghc_economy_limits`; column-level exposure needs product/privacy review before narrowing. |
| 15 | Server-only credentials in Vercel | VERIFIED METADATA | No secret-like `NEXT_PUBLIC_*` variable names found; values were never decrypted. |
| 16 | Testnet payment flag isolation | VERIFIED METADATA | Pi payout/A2U execution flags are Preview-only and branch-scoped to `testnet`. |
| 17 | Mainnet database protection | PRESERVED | Supabase Mainnet is inactive; no Mainnet mutation performed. |
| 18 | Migration history integrity | PRESERVED | No bulk replay/push; existing manually reconciled history is not complete. |
| 19 | Vercel deployment hardening | APPLIED | Fork protection, protected sourcemaps, and directory listing disabled on both Vercel projects. |
| 20 | Vercel runtime placement and diagnostics | APPLIED | Function default region set to `dub1`; full build-system/OOM report enabled in Preview and Production. |

## Live Vercel configuration changes

Applied to `gh-connect-5p3o` and `gh-connect`: Git fork protection, protected sourcemaps, directory listing disabled, and serverless function default region `dub1` (Dublin), geographically close to Supabase `eu-west-1`. Added non-secret `VERCEL_BUILD_SYSTEM_REPORT=1` to Preview and Production to capture complete diagnostics for subsequent build failures. Project domains and existing deployment records were read back and remained present.

## Supabase findings not changed

- Testnet `tpckwgdsjlkzscjlxiwe` is `ACTIVE_HEALTHY`; Mainnet `rrrtjowuldcpbjobbpic` is `INACTIVE`.
- 13 tables with RLS but no policies remain deny-by-default. No generic policies were added because their intended service-only boundaries must not be weakened.
- Two broad SELECT policies were inspected. `ghc_public_identities` contains user ID, public ID, display name, avatar, timestamps and status; `ghc_economy_limits` contains platform-wide transfer/earning limits. These may be intentionally public, but exposure should be narrowed to a server-owned public projection only after confirming current API callers. No policy change was made.
- 113 unused-index advisor notices are not proof of safe removability; indexes may serve low-frequency settlement, reconciliation, expiry, or incident workflows. No index was dropped.
- No user rows, balances, ledger entries, payout requests, payment intents, Pi provider state, or storage objects were changed.

## Release gate

The source-level checks are not a substitute for a clean Node 24.15.0 install, full typecheck/lint/build, browser tests, two-account RLS tests, provider receipts, marketplace concurrency tests, or independent Mainnet approval. Production remains NOT APPROVED.
