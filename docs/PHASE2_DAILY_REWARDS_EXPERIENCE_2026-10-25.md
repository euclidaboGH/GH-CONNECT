# Phase 2 — Daily rewards experience and Rewards Centre

Baseline: GH-CONNECT 0.90.1 Phase 1 archive. Source version: 0.90.2.

## Implemented

- Removed the Home command-centre daily reward card so it no longer inserts a large claim block into the page content.
- Removed the duplicate lightning action from the collapsing feed header. The global fixed lightning control mounted in the app shell is the single claim entry point and does not participate in header layout.
- Repaired an incomplete JSX tail in `enhanced-feed-screen.tsx` found during static parsing, restored the core feed/filter/post-action layout and its overlay wiring, and restored the default export required by the legacy compatibility module.
- Removed the dismiss/hide affordance from the floating claim control. It remains available while the server reports a claimable reward and is hidden once the authoritative status confirms the claim has been used.
- Changed the Rewards Journey daily-claim actions to open the same global claim popup rather than implementing a second independent claim flow. Rewards details, streak progress, pending information, and history remain in the Rewards Centre.
- Added periodic server-status reconciliation every 60 seconds while the document is visible and online, in addition to focus, online, visibility, and claim-event refreshes. This handles status changes from another tab/device and stale claim state without logout.
- After a successful daily claim, request an authoritative wallet snapshot synchronization and emit wallet refresh/sync events. This does not optimistically credit spendable GHC; daily rewards remain pending until the server confirms maturity.
- Fixed the package script that pointed to a missing Pi-backend verifier filename.
- Restored a Node 24-pinned GitHub Actions CI workflow because the source archive lacked the workflow required by its own release-hygiene checks. CI now runs lock/safety/migration checks, TypeScript, lint, and production build without exposing secrets.
- Updated package/release metadata to 0.90.2 and regenerated the repository-only migration inventory/manifest to remove stale version/count metadata.

## Verification

- `node scripts/check-jsx-safety.mjs`: PASS.
- `node scripts/scan-production-safety.mjs`: PASS (21 checks, 0 failures).
- `node scripts/check-project-truth.mjs`: PASS (10/10).
- `node scripts/check-release-hygiene.mjs`: PASS (11/11).
- `node scripts/check-dependency-lock-integrity.mjs`: PASS.
- `node scripts/verify-pi-backend-lock.mjs`: PASS.
- `node scripts/check-clean-migrations.mjs`: PASS (131 unique migration filenames).
- `node scripts/check-database-contract-source.mjs`: PASS (static source contract).
- `node scripts/generate-migration-inventory.mjs --check`: PASS.
- Full TypeScript and production build remain unverified in this environment: archive pins Node.js 24.15.0 (`engines.node: ^24.15.0`), while the available runtime is Node.js 22.16.0 and dependencies are not installed.
- Live testnet behavior still requires a browser session and database-backed verification. The source archive alone cannot prove remote migrations, RPCs, auth, or ledger settlement are live.

## Operator checks before release

1. Sign in with Pi authentication on the intended testnet deployment.
2. Confirm exactly one floating lightning claim control is visible and the Home/header layout does not move when the reward becomes claimable.
3. Claim once; confirm the server response is successful, the control disappears after status reconciliation, and the reward is shown as pending for the 48-hour lock rather than added to spendable balance.
4. Confirm Rewards in Settings shows current claim state, streak, pending reward information, and history without issuing a second claim.
5. Simulate network/server failure; confirm the UI shows an error, the claim remains retryable, and no local balance is credited.
6. Open the same account in a second tab/device and verify status reconciles without logout.
