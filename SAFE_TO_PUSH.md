# Safe to push — release 0.60.9 Phase 1 review status

Static gates currently pass in the packaging environment:

- JSX safety scan: 640 files
- Production safety scan: 21/21
- GHC curation reward static contract: 24/24
- Like/curation separation: 9/9
- Project test scripts: see `GHC_CURATION_REWARD_ENGINE_2026-10-18.md`

Before promoting Testnet:

1. Extract with `app/` at repository root (no nested folder).
2. Use Node.js 24.15.0 (matches `.nvmrc` and the declared supported engine range), then run `npm ci --legacy-peer-deps`.
3. Run `npm run check:release-hygiene`, every `scripts/test-*.mjs` script, `npm run typecheck`, `npm run lint`, `npm run ci:verify`, and `npm run build`. The GitHub Actions static job now runs all repository regression scripts and a migration inventory; it never applies remote migrations.
4. Review the complete migration inventory and apply migrations to the **testnet Supabase project only** in the documented order. Never infer live database state from the repository manifest.
5. Verify reward RPC privileges, wallet ledger idempotency, day-cap behavior, vote toggles, concurrent requests, and Pi Browser flows against test accounts.
6. Confirm Production Vercel environment variables remain bound to mainnet and Preview variables to testnet.

Do not apply the new curation reward migration to mainnet without successful testnet verification and separate explicit approval. Do not commit secrets.

## Phase 1 pipeline harmonization

- CI now pins Node.js 24.15.0 to match the declared runtime contract.
- CI executes every `scripts/test-*.mjs` regression script, release-hygiene checks, migration inventory, typecheck, lint, and build.
- Release hygiene checks package/lock/release-notice version alignment, supported Node runtime, migration filename uniqueness, and accidental local `.env*` files.
- CI does not automatically push migrations to Supabase or deploy production. Testnet and Mainnet database migration histories must be reconciled separately.

## Current verification limitation

Dependencies were not installed in this workspace; TypeScript, ESLint, and the Next.js production build are not yet verified here. SQL migration execution and live database concurrency tests have not been performed. The source package is not a deployment confirmation.


## Phase 2 status (0.61.0)

- Added `.env.example` and automated environment-reference coverage.
- Added Preview/Testnet vs Production/Mainnet readiness regression coverage.
- **Not release-cleared:** full build and live Testnet migration/E2E checks are outstanding. See `PHASE_2_FULL_PROJECT_AUDIT_2026-10-18.md`.
- Do not apply all migrations blindly; reconcile target migration history first.
