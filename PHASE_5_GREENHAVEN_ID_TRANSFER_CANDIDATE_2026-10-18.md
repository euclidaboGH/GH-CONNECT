# Phase 5 — GreenHaven ID transfer candidate (2026-10-18)

## Scope implemented

- `POST /api/economy/transfers` now requires a valid `GH-XXXXXX` public ID and resolves it through the canonical server-side public identity directory before invoking the atomic transfer RPC.
- The server derives the sender from the authenticated session, derives the recipient account key from the resolved identity row, and uses the directory display name rather than trusting a client-provided recipient name.
- The transfer HTTP contract sends `toGreenHavenId`, not a client-authored internal destination key.
- The Send GHC flow verifies selected directory recipients and validates/resolves manually entered IDs; wallet quick-transfer validates/resolves its recipient ID. Both carry the resolved public ID into the economy domain.
- Identity ensure/resolve now fails closed when a privileged database is configured but the public-ID RPC fails. Production no longer silently creates process-local identities that cannot resolve consistently across instances.
- Added `scripts/test-greenhaven-id-transfers.mjs` and wired it into `ci:verify`.

## Existing architecture reused

- `ghc_public_identities`, `ghc_ensure_public_id`, and `ghc_resolve_public_id` from the existing public identity migration.
- `ghc_execute_transfer` remains the atomic double-entry ledger operation. This phase does not create a second ledger or client-side transfer credit path.
- Existing transfer request acceptance continues to use its own atomic request/transfer RPC flow; the public-ID requirement applies to direct recipient-selected transfers.

## Checks run

- GreenHaven ID transfer source-contract tests: **12/12 passed**.
- Daily Claim 48-hour lock tests: **13/13 passed**.
- Daily Claim-to-wallet pipeline tests: **35/35 passed**.
- Economy v1.2 tests: **173/173 passed**.
- Ten-phase baseline: **8/8 passed**.
- Vercel build-repair regression: **9/9 passed**.
- Release hygiene: **10/10 passed**.
- Rewards reliability: **24/24 passed**.
- Curation reward source checks: **24/24 passed**, atomic curation pipeline **7/7 passed**.
- Migration release-readiness static check reports 87 SQL files and 10 future-dated migration files; these remain operator-review items.

## Required before declaring Phase 5 complete

1. Reconcile Testnet migration history and confirm `ghc_public_identities`, `ghc_ensure_public_id`, `ghc_resolve_public_id`, `ghc_execute_transfer`, ledger constraints, and transfer limits exist with expected signatures and ACLs.
2. Run two-account Testnet transfers using actual GreenHaven IDs; verify recipient lookup, self-transfer rejection, blocked/restricted account checks, insufficient balance, daily limits, and exact balance conservation.
3. Replay the same `referenceId`, submit concurrent transfers, interrupt responses after commit, and confirm exactly one debit and one matching credit.
4. Verify notification failure cannot reverse a committed transfer and that both users rehydrate from the authoritative wallet snapshot.
5. Run clean dependency install, TypeScript, lint, and Next.js production build. These have not been verified in this environment.

## Explicit limits

This is a source candidate only. No database migration, live query, Git push, Vercel deployment, Testnet transaction, or Mainnet operation was performed. The public-ID database schema/RPCs are reused from existing migrations; their live application status is unknown. The global policy that Daily Claim is the only permitted new-user-GHC issuer remains Phase 6 and is not completed by this phase.
