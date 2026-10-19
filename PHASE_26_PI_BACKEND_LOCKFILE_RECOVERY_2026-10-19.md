# Phase 26 — official Pi backend lockfile recovery

## Why the lockfile is incomplete

`package.json` pins the official `pi-backend@0.1.3` package, which is used by the server-side Pi A2U create and recovery routes. The current `package-lock.json` does not contain `node_modules/pi-backend`. A valid lock must be generated from npm's published metadata; do not invent tarball URLs, versions, transitive dependency versions, or integrity hashes.

The official SDK's published dependency metadata includes `axios` and `stellar-sdk`. The verifier in `scripts/verify-pi-backend-lock.mjs` requires the official registry tarball, registry-generated integrity metadata, and both direct SDK dependencies to appear in the lock graph.

## Option A — repair locally (recommended when npm registry is reachable)

Use the project's pinned Node runtime (Node 24.15.0), from the repository root:

```bash
node --version
npm view pi-backend@0.1.3 version dist.tarball dist.integrity --json
npm install --package-lock-only --legacy-peer-deps --no-audit --no-fund
node scripts/check-dependency-lock-integrity.mjs
node scripts/verify-pi-backend-lock.mjs
npm ci --legacy-peer-deps --no-audit --no-fund
npm ls pi-backend --depth=0
npm run ci:verify
```

Review `git diff -- package-lock.json`. Commit the npm-generated lockfile only after all commands succeed. If the registry cannot be reached, stop and retry from a network-connected environment; do not manually add lockfile entries.

## Option B — GitHub Actions repair pull request

1. Commit and push the project including `.github/workflows/repair-npm-lock.yml` to GitHub. The workflow does not run automatically on push.
2. In GitHub, open **Actions → Repair npm lockfile → Run workflow** and select the branch to repair.
3. The workflow queries official npm metadata, regenerates the lockfile on Node 24.15.0, verifies the Pi SDK and direct dependencies, performs `npm ci`, and runs `npm run ci:verify` (including the regression suite, typecheck, lint, and production build).
4. Only after all checks pass, it opens a pull request containing `package-lock.json` only. Review the diff and CI before merging.

The workflow requires repository Actions permissions that allow `GITHUB_TOKEN` to write contents and pull requests. Organization policies or branch rules may require an administrator to allow this. The workflow does not deploy to Vercel, mutate Supabase, run Pi payments, or enable payouts.

## Fail-closed requirements

- Keep `pi-backend@0.1.3` pinned until a separately reviewed SDK upgrade is planned.
- Do not remove the SDK or replace its runtime import with a type-only declaration to hide the missing package.
- Do not commit credentials, private seeds, `.env` files, or provider secrets.
- Do not deploy until clean install, typecheck, lint, `npm run ci:verify`, and a production build all pass on the regenerated lockfile.
- This lock repair does not establish live Pi Testnet correctness, Paystack reconciliation correctness, database migration readiness, or visual QA; those remain separate release gates.
