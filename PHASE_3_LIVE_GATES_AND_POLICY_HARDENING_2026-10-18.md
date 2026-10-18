# Phase 3 — live gates and policy hardening (2026-10-18)

## Changes in this package

- Restored `.env.example`, which was missing from the Phase 2 archive despite static checks requiring it. The template documents all environment references found in app/lib/components/middleware and uses blank values for secrets.
- Explicitly documents separate Vercel Preview/Testnet and Production/Mainnet values and separate Supabase projects.
- Added `docs/TESTNET_LIVE_RELEASE_GATES.md` with read-only preflight, migration-history reconciliation, two-account isolation, payment replay, self-curation, anti-abuse, and final evidence steps.
- Added `scripts/test-release-gates-policy.mjs` and wired it into `ci:verify` to protect key release invariants: no GHC mutation from GHPV settlement, service-role-only settlement RPC, curation-to-reputation bridge remains gated pending correction-safe compensation, self-curation excluded from independent evidence/rewards, and live migrations are not blindly pushed.
- Bumped package/lockfile/app release metadata to 0.61.1.

## Checks passed

- 78/78 `scripts/test-*.mjs` scripts passed.
- Production safety scan: 21/21.
- Release hygiene: 10/10.
- Deployment network safety: 10/10.
- Release-gates policy: 9/9.
- JSX safety: 640 files scanned.
- Migration inventory: 86 SQL files; the self-curation guard precedes the later allowance. Ten future-dated migrations are explicitly flagged for review.

## Not verified / not done

- `npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund` timed out in the execution environment; TypeScript, ESLint, and Next.js production build remain unverified.
- No connected Supabase, Vercel, GitHub, or Pi operator integration/credentials were available in this session. Remote migration history, live Preview readiness, Pi Testnet sign-in/payments, and authenticated two-account isolation were not run.
- No remote migration, GitHub push, or Vercel deployment was performed.
- Settled-curation-to-reputation bridge and coordinated-account detection remain gated/incomplete. The 80/20 split remains a target policy until authoritative server-side evidence and caps are fully wired and tested.

## Release stance

Prepare a candidate commit, but do not approve deployment until the required build checks pass and Testnet's remote migration history is reconciled. Mainnet remains untouched.
