# GH-CONNECT Vercel deployment repair — Run 319

## Source baseline

This repair is based exclusively on the user-supplied `GREENHAVEN-0.338.99-RUN318-PI-AUTH-RELIABILITY-FULL-PROJECT-2026-11-17-2.zip` archive. The project files are laid out directly at the archive root; there is no enclosing `GREENHAVEN-.../` folder.

## Confirmed deployment failure and correction

The reported Vercel failure was caused by a project Root Directory mismatch. Vercel was looking inside the old nested `GREENHAVEN-0.338.99-RUN317` folder, while this source archive has `package.json`, `package-lock.json`, `vercel.json`, `next.config.mjs`, `app/`, and `scripts/` directly at the repository root. As a result, Vercel did not see the lockfile and `npm ci` stopped with `EUSAGE`.

Correct Vercel project settings:

- Git repository: `euclidaboGH/GH-CONNECT`
- Branch for Preview verification: `testnet`
- Root Directory: repository root (`.` / blank default)
- Framework preset: Next.js
- Node.js version: `24.x` (the project requires `^24.15.0`)
- Install command: use the repository `vercel.json` command (`npm ci --legacy-peer-deps`, after clearing unsupported npm `cache-dir` config)
- Build command: use the repository `vercel.json` command (clean stale Webpack cache, then `npm run build`)

Do not set Root Directory to `GREENHAVEN-0.338.99-RUN317` for this flattened project archive.

## Hosted verification

Vercel Preview deployment `dpl_3BbiqVEYirk7GbdZLdn9oQR4q3mX` from `testnet` commit `347c849a6d93ac62fdeaf03e8528ee26a9e65700` reached `READY`.

Observed results:

- `npm ci --legacy-peer-deps` completed and added 486 packages.
- Next.js 15.5.26 was detected.
- The project prebuild runner executed 364 checks.
- Next.js production build completed in approximately four minutes.
- Vercel created serverless functions and collected static files.
- Deployment completed and Vercel reported `READY`.
- Vercel build system reported no memory or disk-space problems.

Preview URL: https://gh-connect-5p3o-fxhvb2l93-green-haven-s-projects.vercel.app

## Local source checks

- ZIP integrity: passed.
- `scripts/check-dependency-lock-integrity.mjs`: passed.
- Node runtime contract: project declares `^24.15.0`; hosted Vercel runtime was Node 24.22.3.
- Run #299 Vercel build contract: 20/20 passed.
- Vercel build hygiene: 17/17 passed.
- Prebuild dry-run: 365 checks discovered; all referenced script paths exist.

The local container only has Node 22.16.0, below the project's supported runtime, so a local production build was deliberately not claimed. A local `npm ci` attempt was not completed within the available execution window. The successful hosted Vercel build is the authoritative install/build verification for this baseline.

## Remaining warning — dependency security

The hosted install reported 29 npm audit findings: 1 low, 5 moderate, 21 high, and 2 critical. The build did not fail because of these findings. An audit-detail request from the local environment could not reach the npm registry, so no specific vulnerable dependency or safe upgrade is asserted here. Do not run `npm audit fix --force` blindly: this project includes Pi authentication, wallet, payment, and Stellar-related dependencies. Resolve each advisory against the full npm audit report with compatibility and regression tests before changing the lockfile.

## Safety boundaries

This repair changes no Supabase schema or data, no Pi identity mapping, no wallet balance, no transaction PIN, no consent state, no payout execution flag, and no Mainnet setting. It does not promote the Preview deployment to Production.
