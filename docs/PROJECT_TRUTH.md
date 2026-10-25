# GreenHaven project truth and release authority

**Current source version:** `0.91.2`

This document describes the checked-in archive only. It does not establish that any remote deployment, database migration, payment provider, Pi Platform integration, or account-security flow is live or verified.

## Authority

- Application package version: `package.json`.
- Locked dependency graph and root package metadata: `package-lock.json`.
- In-app release label: `lib/app-release.ts`.
- Canonical SQL migration inventory: `supabase/migrations/`, summarized by `docs/MIGRATION_CHECKLIST.md` and `VERIFIED_MANIFEST.txt`.
- Automated verification workflow: `.github/workflows/ci.yml`.
- Runtime requirement: `.nvmrc` and the `engines.node` field in `package.json`.

All version sources must agree. If they do not, stop release work and reconcile the metadata rather than guessing which version is authoritative.

## Current verification limits

- The supported Node.js runtime is `^24.15.0`; Node.js 22 is unsupported for this project.
- Static JSX, lockfile coverage, and Pi backend lock checks can be run independently. TypeScript, lint, and Next.js production build must run with the supported Node runtime and installed locked dependencies.
- A source migration inventory is not evidence of applied migrations. Reconcile Testnet and Mainnet migration history independently using the Supabase CLI and target project.
- Testnet Pi authentication/payments, multi-account authorization, private-media access, notifications, messaging, payouts, and provider webhooks require live or disposable-environment evidence before enabling or releasing them.
- Mainnet must not be changed as part of source repair. Do not bulk-apply SQL migrations or enable financially sensitive flags based only on this repository inventory.

## Required pre-release checks

1. Use Node.js `24.15.0` or a compatible later `24.x` version satisfying `package.json`.
2. Run `npm ci --legacy-peer-deps --no-audit`.
3. Run `npm run check:jsx`, `npm run check:release-hygiene`, `npm run check:dependency-lock-integrity`, `npm run check:pi-backend-lock`, `npm run check:clean-migrations`, and `npm run check:migration-release-readiness`.
4. Run `npm run typecheck`, `npm run lint`, and `npm run build`.
5. Review migration classifications and reconcile actual target history before applying any SQL.
6. Complete the Testnet evidence checklist and receive explicit approval before any Mainnet release.

**Release status: NOT APPROVED by this document.** Passing static checks does not replace build, database, integration, security, or operator verification.


## v0.90.9 payment retry reliability
Payment failure handling now preserves community/group drafts and stable IDs, and adds regression coverage for marketplace listing-fee retries. Static verification passed 11/11; live testnet payment behavior is not certified by this source-only check.


## v0.91.0 notification center restoration

The global notification bell is mounted in the primary app shell again. Notification source wiring, update refresh, accessible focus, and section attention indicators have been hardened. See `PHASE-28-NOTIFICATION-CENTER-RESTORATION.md`.


## v0.91.2 daily rewards reliability

The daily claim experience now opens once when server status confirms a new claimable day. If status is temporarily unavailable, the lightning action remains usable and the server remains the authority for claim acceptance. Claim failures remain retryable; no client-side balance minting or economy bypass was introduced.


## v0.91.2 wallet and utility reliability

Wallet action wiring and the Spend GHC path received a surgical reliability pass. The legacy boost chip now opens the utility catalog instead of silently returning when its domain method is absent. Utility purchases require a review step, target-bound purchases require a target, catalog load errors can be retried, and request idempotency keys remain stable across retries. Unconfigured effects stay unavailable and fail closed. Static contract checks do not prove live database settlement or production build readiness; the release remains NOT APPROVED until Node 24 build and authenticated testnet verification complete.
