# GreenHaven Vercel build repair — 0.89.1

## Source of truth
This repair is based on the supplied `GH-CONNECT-0.89.1-LEAN-FULL-GITHUB-1.zip` project archive. It preserves the current product architecture, Supabase migrations, Pi authentication and server-authoritative GHC boundaries.

## Repairs applied

1. `components/ghc/premium-community-hub.tsx` imported `resolveDisplayUrl`, but the media module exported `resolveDisplayMediaUrl`. Added a backwards-compatible exported alias so the existing component contract resolves without changing other callers.
2. `components/ghc/create-group-modal.tsx` accessed `uploaded.url` without narrowing the `DurableMediaResult` discriminated union. Changed the success branch to require both `uploaded.ok` and `uploaded.durable` before reading the URL. Failed uploads can no longer be mistaken for successful durable uploads at this branch.
3. Added a GitHub Actions verification workflow for supported Node 24, locked dependency installation, static safety/release checks, typecheck and production build.
4. Added a Git ignore policy for generated files, local secrets and build outputs while retaining `.env.example`.

## Verification limits
The local execution environment only provides Node `v22.16.0`; this repository explicitly requires Node `^24.15.0`. Dependency installation was attempted but timed out in this environment. Therefore a local Next.js production build and typecheck could not be honestly marked as passing. The added CI workflow pins Node `24.22.1` and will perform the full build in a supported environment.

## Vercel follow-up
- Keep the project runtime on Node.js 24.x (compatible with the repository engine and `.nvmrc`).
- Redeploy the uploaded source after pushing this archive's contents.
- Review the `npm audit` output from a registry-connected Node 24 environment. Do not use `npm audit fix --force` blindly: major upgrades can break Pi SDK, Next.js or media/auth contracts.
- The reported npm `cache-dir` warning is an environment/npm configuration warning, not the TypeScript failure shown in the supplied log. Inspect Vercel project/build environment for `npm_config_cache_dir` or equivalent before changing dependency configuration.
- Supabase migrations and Vercel environment variables remain operator-managed; this archive does not claim to have applied live database migrations or verified live Pi/Supabase credentials.
