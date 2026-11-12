# Upgrade worklog — 0.330.16

- Baseline: user-provided `GH-CONNECT-0_330_15-GREENHAVEN-FULL-PROJECT-CI-GREEN.zip` (SHA-256 `40346c81399f761702c9ed0871683641f6f70317eaa3e0569103322a48590587`).
- Confirmed internal package/source release identity was 0.330.15; archive filename is not treated as package metadata.
- Hardened notification account-switch lifecycle with identity scoping, abortable requests, generation fencing and stale-state clearing.
- Added accessible selected-state semantics to Feed, Messages, Communities and Marketplace filters.
- Added Phase 30 regression gate to prebuild and static verification.
- Updated current release metadata and reconciled canonical migration count to the on-disk 191-file inventory.
- No migration, payment, payout, reward issuance, membership grant, wallet ledger or production approval change.
- Verification limitation: this workspace runs Node 22.16.0; the supported project runtime is Node.js 24.15.0, so typecheck/lint/production build must be rerun in the supported runtime. Static/source-only verification is not production approval.
