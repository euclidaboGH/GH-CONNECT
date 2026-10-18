# Professional implementation review — 2026-10-18

## Scope
Reviewed the current GH-CONNECT 0.60.3 source package, curation reward migration, curation API, post-card interaction, migration inventory, CI wiring, and existing static/regression suites. This is a source-level review only; it is not a live Supabase/Vercel audit.

## Remediation performed

- Corrected curation-button long-press behavior so opening the reaction tray suppresses the release-click vote. Pointer release/cancel outside the control is handled to avoid stale suppression state.
- Explicitly revoked direct table access to `ghc_curation_reward_claims` from `PUBLIC`, `anon`, and `authenticated`; granted access to `service_role` and retained RLS deny policy.
- Pinned the reward RPC's `SECURITY DEFINER` search path to `pg_catalog, public`.
- Added curation reward and Like/curation separation tests to `ci:verify` and the production verification pack.
- Refreshed `VERIFIED_MANIFEST.txt` to match the current 82 on-disk migrations. The manifest is inventory only and does not claim that any database has applied them.
- Updated the testnet-first release instructions and explicit verification limitations.

## Source-level verification

- Production verification pack: 42/42 automated suites passed.
- Curation reward contract tests: 24/24 passed.
- Like/curation separation: 9/9 passed.
- JSX safety: 640 files scanned.
- Production safety scan: 21/21 passed.
- Social authorization static scan: 38/38 passed.
- IDOR static scan: 136/136 passed across 124 routes.
- Additional `scripts/test-*.mjs` suites were run individually; all selected test scripts passed.
- `package.json`, `package-lock.json`, and lockfile root versions all match 0.60.3.

## Still required before any release

- Install dependencies under supported Node.js 24.15+ and run TypeScript, ESLint, and the complete Next.js production build.
- Run SQL migration validation against a disposable PostgreSQL/Supabase test environment.
- Apply the curation reward migration to **testnet only**, after reconciling testnet migration history and reviewing the full migration order.
- Verify actual concurrent reward requests, ledger idempotency, balance locks, daily cap interactions, restricted users, vote toggles, and Pi Browser end-to-end behavior.
- Confirm Vercel Production remains mainnet and Preview remains testnet. No deployment, live migration, or mainnet change was performed during this review.
