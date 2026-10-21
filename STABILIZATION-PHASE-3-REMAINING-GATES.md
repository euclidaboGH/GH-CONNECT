# Phase 3 — Remaining security and migration gates

Run from the updated project root.

## Local source and build gates

```bash
npm run check:runtime
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run test:stabilization-phase3-security
npm run check:migration-inventory
npm run check:project-truth
npm run audit:project-integrity
npm run build
```

## Database and remote migration gates

- Start with a disposable PostgreSQL database; never use Mainnet as the first SQL test target.
- Validate every migration's dependencies, grants, RLS, RPC ownership, idempotency, lock behavior, rollback assumptions, and expected data changes.
- The static migration readiness gate currently blocks on duplicate numeric versions: `202610170001_ghpv_settlement_engine.sql` / `202610170002_match_signals_durable.sql`, and `202610180012_gh_engagement_rosters.sql` / `202610170003_ghpv_calibration_bounds.sql`. Do not rename either file until Testnet and Mainnet histories have both been captured and compared.
- Capture `supabase migration list` for Testnet and Mainnet separately. Compare local/remote versions before changing the canonical migration directory or applying anything.
- Do not run `supabase db push` while any pending migration is `REVIEW_REQUIRED`, `REQUIRES_APPROVAL`, or `PROPOSAL`. Supabase CLI does not enforce the repository's labels.
- Do not delete/rename migrations already represented in remote history. If a proposal is confirmed never applied in any target, move it to `docs/proposals/sql/` and update tests/inventory only after recording that evidence.

## Security runtime gates

- Verify a revoked step-up is rejected on a second app instance even if that instance previously cached a valid proof.
- Simulate durable step-up revoke failure and confirm logout/session-management routes return `503` without reporting successful completion.
- Simulate same-device session-revoke failure and confirm no replacement session is issued while the old shared session may still be valid.
- Simulate bulk session revoke failure and confirm local caches are not marked revoked before durable storage confirms the change.

- Test step-up creation when durable insert succeeds, fails, times out, or database configuration is missing.
- Test session revocation when durable update succeeds/fails, and verify a second app instance rejects the revoked token.
- Test current-session and other-session revocation with two users; confirm cross-user session IDs cannot be revoked.
- Test cookie behavior inside Pi Browser and ensure mutation endpoints remain protected against cross-site requests without breaking embedded auth.
- Test account export ownership, completeness, rate limiting, no-store headers, and absence of tokens/service secrets.
- Record the results with environment, commit SHA, test accounts (non-sensitive identifiers only), timestamps, and operator sign-off.

Mainnet remains blocked until all required evidence is recorded and explicitly approved.

## Remote migration history evidence (added 2026-10-21)

- [ ] Capture Testnet `supabase migration list` output in a trusted shell.
- [ ] Capture Mainnet `supabase migration list` output separately; do not reuse one environment's output for the other.
- [ ] Run `node scripts/reconcile-remote-migration-histories.mjs --testnet <file> --mainnet <file> --out <report>`.
- [ ] Investigate the duplicate local versions `20261017` and `20261018`, remote-only versions, local-only versions, and schema/content drift.
- [ ] Validate reviewed SQL and dependencies on disposable PostgreSQL before any environment changes.
- [ ] Only then decide whether unapproved/unapplied proposals can be moved out of `supabase/migrations/` and how any already-applied duplicate version should be reconciled.
- [ ] Keep `supabase db push` blocked until the evidence and approvals are complete.

The checker is read-only and compares migration version strings, not SQL checksums or live schema behavior. See `docs/REMOTE_MIGRATION_RECONCILIATION.md`.

## Future migration content review (2026-10-21)

See `docs/FUTURE_MIGRATION_CONTENT_AUDIT.md` for per-file review of all 15 future-dated migrations and the four colliding migration versions. The duplicate pairs contain distinct SQL and must both be retained, but their version identifiers must be reconciled after separate Testnet/Mainnet history capture. The story-reaction RPC received a source-level audience-authorization fix; if its migration was already applied remotely, a forward corrective migration is required after history reconciliation. PostgreSQL execution and live authorization/provider tests remain open gates.
