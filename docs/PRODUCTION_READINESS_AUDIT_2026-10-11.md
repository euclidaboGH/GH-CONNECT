# GH Connect — Production Readiness Audit

**Audit date:** 2026-10-11  
**Scope:** repository source, API routes, Supabase migrations, auth/session lifecycle, social authorization, economy/payment boundaries, community/discovery/messaging wiring, static safety gates, and release tooling.

## Decision

**Not yet certified production-ready.** The repository's automated static/repository gates pass after correcting three stale assertions in the test suite. A full dependency-clean TypeScript check, lint, Next.js production build, remote Supabase migration reconciliation, and live Pi Browser/payment/concurrency tests remain operator gates. Do not interpret the static suite as proof of live-system correctness.

## Work performed

- Updated stale source-contract assertions to match the implemented architecture:
  - Match-screen connect now goes through `submitConnectionFromPicker` (intent validation flow), rather than expecting a direct `sendUnifiedConnectionRequest` call.
  - Discovery test now checks the actual screen heading and its visible broad-purpose copy.
  - Runtime test now validates the declared supported Node range rather than requiring the narrower exact string `24.x`.
- Ran repository safety scan: **21 passed, 0 failed**.
- Ran release verification: **30 automated suites passed, 0 failed, 0 skipped**.
- Ran JSX safety scan: **601 files scanned, passed**.
- Ran IDOR static checks: **122 passed, 0 failed** across **110 API routes**.
- Ran social authorization checks: **30 passed, 0 failed** across **30 routes**.
- Ran economy v1.2 tests: **173 passed, 0 failed**.
- Ran PI durable-payment static tests: **40 passed, 0 failed**.
- Existing scripts explicitly note that live multi-instance Supabase, live WebAuthn registration/assertion, and remote migration reconciliation are not covered by static tests.

## Blocking verification items

1. **Dependency installation / typecheck / lint / build:** the current extracted workspace has incomplete `node_modules`; `npm run typecheck` fails at missing type-definition packages (including Node, React, d3 and other transitives). This is not a valid source-code typecheck result. Run a clean install from `package-lock.json`, then typecheck, lint, and build.
2. **Supabase migrations:** compare local migrations against the intended Testnet project, reconcile already-applied versions, and run a dry-run before any push. Never repair migration history by blindly deleting rows or re-running potentially non-idempotent SQL.
3. **Pi authentication/onboarding:** verify a returning user with a saved profile reaches the feed, a genuinely new user sees onboarding, an incomplete profile sees only required fields, and two different Pi identities cannot map to the same account. Test after logout/login and server restart.
4. **Economy/payment:** run duplicate/replay, concurrent requests, provider callback/signature, settlement idempotency, and rollback tests against Testnet. Confirm that client inputs cannot authorize a balance change.
5. **Authorization/privacy:** run the documented IDOR checklist against a deployed Testnet build with two distinct accounts; static scans alone cannot prove row-level security or session invalidation behavior.
6. **Operational readiness:** confirm production env vars, Supabase RLS/policies, backups and restore drill, alerting/logging, rate limits, error monitoring, and rollback procedure before production rollout.

## Recommended clean-room verification (Windows PowerShell)

```powershell
# From the project root; use the Node version allowed by package.json
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run test:idor-static
npm run test:social-authz
npm run test:economy
npm run build
npm run test:release
```

Before pushing migrations, inspect the local/remote list and dry-run first:

```powershell
supabase.cmd migration list
supabase.cmd db push --dry-run
```

Only push after confirming the target project is **Testnet**, the migration plan is expected, and the database backup/recovery plan is available.

## Release acceptance criteria

- Clean install, typecheck, lint, and production build all pass on the same Node/npm versions used by deployment.
- Vercel deployment succeeds and `/api/health` reports required durable identity/session/Supabase configuration as healthy.
- Testnet migration history and schema match the checked-in migration plan.
- Auth/onboarding, cross-user isolation, social workflows, messaging, uploads, notifications, and financial flows pass deployed end-to-end tests.
- Duplicate payment/claim/reward operations are idempotent under concurrent requests.
- Operator signs off on monitoring, backups, incident response, and rollback.

## Limitations

This audit does not have access to the user's live Vercel environment variables, Pi Browser session, Supabase production/Testnet credentials, provider secrets, or remote database state. It therefore does not claim that remote services are configured correctly or that a production deployment has been proven safe.
