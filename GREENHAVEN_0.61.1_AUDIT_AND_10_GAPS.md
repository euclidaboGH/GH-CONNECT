# GreenHaven 0.61.1 — Audit Findings and Upgrade Register
**Audit basis:** `GH-CONNECT-0.61.1-ESSENTIAL-20-PASS12-2026-10-19.zip`
**Scope:** static repository review only. No live Supabase, Vercel, GitHub, Pi Testnet, or Mainnet access was used.

## Verified baseline
- ZIP integrity check passed.
- 127 API route files, 97 SQL migration files, and 117 existing `test-*.mjs` scripts were present at intake.
- All 117 existing `test-*.mjs` scripts executed successfully in the local Node environment.
- Full TypeScript, ESLint, Next.js production build, and browser tests were not run because `node_modules` is absent in this worktree.

## Ten material feature gaps / integration risks

1. **Deleted-post recovery** — the repository documented that soft-deleted posts could not be restored. Implemented an owner-only, 30-day restore RPC and API route in this upgrade. Restoration does not recreate GHPV votes/weights or mint/transfer GHC.
2. **CQI/quality-aware feed ranking** — explicitly deferred. Add only after ranking inputs, privacy rules, fairness controls, pagination stability, and abuse resistance are specified and tested.
3. **Creator quality payouts** — deferred. Must be funded by an approved, balance-backed pool and idempotent server settlement; never pay based on client-supplied scores or vote counts.
4. **Vote-to-GHC rewards** — deferred and should remain disabled until anti-Sybil eligibility, pool accounting, caps, reversals, and replay protections are reviewed. Votes must not directly mint GHC.
5. **Durable tip settlement** — tip intents exist, but completed financial settlement needs a separately audited idempotent ledger flow; creating an intent must never imply payment completion.
6. **Complete seller payout lifecycle** — marketplace order/inventory flows exist, but payout reconciliation, refunds, dispute holds, and operator auditability require end-to-end verification before launch.
7. **Soft-delete retention and recovery operations** — restoration is now available for 30 days, but automated retention/purge policy, legal holds, and operator audit logs still need definition before any purge job is added.
8. **Private media delivery** — existing upload hardening does not implement end-to-end private-bucket signed delivery. Media visibility, signed URL expiry, authorization, and caching need a cohesive implementation.
9. **Account export and account deletion lifecycle** — verify a complete user-data export and a compliant deletion workflow across posts, messages, media, sessions, and financial/audit records; preserve records that must legally remain.
10. **Operational release evidence** — source tests do not prove schema application or deployed behavior. Require clean install, typecheck, lint, production build, browser smoke tests, migration-history reconciliation, and Testnet verification before release claims.

## Implemented in this upgrade
- `POST /api/social/posts/[id]/restore`, authenticated and owner-scoped through a server-only RPC.
- `supabase/migrations/202610250002_gh_post_restore_owner_window.sql`, with row locking, 30-day recovery limit, service-role-only execution, and no GHC mutation.
- `scripts/test-post-restore.mjs` source regression tests.
- Explicit response fields state that curation weights are not restored, avoiding a false promise of full historical recovery.

## Deployment safety
This package is a source-level candidate, not a deployed release. Do not apply the new migration blindly. Reconcile the exact migration history and schema on the intended Testnet project, apply in a reviewed sequence, and test with owner, non-owner, missing-post, already-active, and expired-post cases. Keep Mainnet untouched until Testnet validation and release approval are complete.
