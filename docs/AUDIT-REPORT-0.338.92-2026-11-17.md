# GREENHAVEN full-project audit — 0.338.92 (2026-11-17)

**Audit baseline:** `GREENHAVEN-0.338.92-TESTNET-QUARANTINE-ENV-PREP-2026-11-17-1.zip`  
**Baseline SHA-256:** `90cb8260f2b5a7fdf345135c636c250b591eb4a0be625d86b61eae988e12b578`  
**Package:** `gh-connect@0.338.92`  
**Release status:** NOT APPROVED. No GitHub push, Vercel deployment, database migration, or blockchain transaction was performed.

## Executive assessment

The repository contains a broad social, messaging, marketplace, wallet, rewards, identity, Pi payment, research, field-report and evidence-management platform. The source has useful security foundations and extensive static regression coverage. However, this archive is not currently buildable: the global TypeScript parser reports syntax errors across 17 server-side source files. These errors include malformed imports and malformed Supabase REST/RPC call expressions. Do not deploy or apply migrations from this source until those errors are repaired and the complete build/test gates pass.

The audit therefore prioritizes correctness, security, database integrity and release reproducibility over adding more product surface area. New feature work should follow restoration of a clean compile and verified end-to-end behavior.

## Inventory and execution evidence

- Archive entries: 3,119.
- TypeScript source files: 865.
- TSX component files: 232.
- JavaScript module files: 549.
- SQL files across the wider project tree: 252.
- Canonical `supabase/migrations` SQL files: 229.
- Mutating HTTP API routes: 173 after route ownership reconciliation.
- Prebuild checks declared: 358.
- Under the available Node 22.16.0 runtime, 319 prebuild checks passed, 38 failed, and the Node runtime gate was skipped so the remaining checks could be diagnosed. This is not a passing prebuild run.
- Global TypeScript 5.8.3 parser: 170 syntax diagnostics across 17 files. The project requires Node 24.15.0 and its own pinned dependency toolchain; full project typechecking remains unverified.

## Critical blocker — source syntax and transport corruption

The TypeScript parser reports syntax diagnostics in:

1. `lib/server/economy/correlation.ts`
2. `lib/server/economy/public-id.ts`
3. `lib/server/economy/store.ts`
4. `lib/server/ghpv/settle-service.ts`
5. `lib/server/ghpv/vote-weight.ts`
6. `lib/server/identity/achievement-store.ts`
7. `lib/server/identity/pi-identity-store.ts`
8. `lib/server/identity/session-store.ts`
9. `lib/server/identity/step-up-store.ts`
10. `lib/server/identity/webauthn-store.ts`
11. `lib/server/identity/withdrawal-pin.ts`
12. `lib/server/media/owned-attachment-validation.ts`
13. `lib/server/membership/entitlement-store.ts`
14. `lib/server/messaging/message-store.ts`
15. `lib/server/payments/intent-store.ts`
16. `lib/server/reputation/store.ts`
17. `lib/server/revenue/cashback-attribution.ts`

A wider source scan also found malformed or suspicious Supabase REST/RPC wrapper patterns in 34 files (44 matching lines). Some are syntactically valid but pass literal interpolation strings or serialized JSON where the central transport expects an RPC name and an object. These must be reviewed individually; do not blindly mass-rewrite business-critical wallet, payment, identity, messaging or settlement operations.

## Other failed prebuild checks requiring repair or reconciliation

The remaining 38 failing checks are recorded by script name below. Failures include absent repository-only metadata, incomplete dependency installation, syntax-dependent checks, stale regression expectations, and substantive transport/authorization contracts that need source-level review.

- `scripts/check-run300-release-integrity.mjs`
- `scripts/check-run250-identity-mapping-integrity.mjs`
- `scripts/check-jsx-duplicate-props.mjs`
- `scripts/check-phase2-database-integrity-closeout.mjs`
- `scripts/check-50-essential-upgrades.mjs`
- `scripts/check-phase1-10-upgrade-pack.mjs`
- `scripts/check-phase10-release-closure.mjs`
- `scripts/check-release-hygiene.mjs`
- `scripts/check-phase9-membership-release-gate.mjs`
- `scripts/check-priority3-rewards-wallet-pin.mjs`
- `scripts/check-phase3-marketplace-premium.mjs`
- `scripts/check-pass40-feed-reconciliation.mjs`
- `scripts/check-pass38-data-contracts.mjs`
- `scripts/check-build-type-regressions.mjs`
- `scripts/check-phase2-spend-rpc-contract.mjs`
- `scripts/check-phase5-cashback-attribution.mjs`
- `scripts/check-phase9-charity-utility.mjs`
- `scripts/check-phase10-testnet-release-gate.mjs`
- `scripts/check-phase12-earnings-final-gate.mjs`
- `scripts/check-phase-c-marketplace-trust.mjs`
- `scripts/check-phase-f-production-proof.mjs`
- `scripts/check-phase-1-6-hardening.mjs`
- `scripts/check-phase7-treasury-operations.mjs`
- `scripts/check-phase7-treasury-completion.mjs`
- `scripts/check-phase17-ci-governance.mjs`
- `scripts/check-phase19-marketplace-rpc-transport.mjs`
- `scripts/check-phase23-treasury-community-reconciliation.mjs`
- `scripts/check-residual-debt-hardening.mjs`
- `scripts/check-phase24-release-review.mjs`
- `scripts/check-phase26-wallet-ledger-resilience.mjs`
- `scripts/check-phase28-wallet-consent-flow.mjs`
- `scripts/check-phase2-closeout-attachments-design.mjs`
- `scripts/check-run249-wallet-recovery-build-guards.mjs`
- `scripts/check-run263-essential-hardening.mjs`
- `scripts/test-run272-vercel-build-prep.mjs`
- `scripts/check-services-directory-release-gate.mjs`
- `scripts/check-run299-vercel-build-contract.mjs`
- `scripts/check-phase6-performance-accessibility.mjs`

## Repository metadata gap

The archive intentionally omits `.github/workflows/ci.yml` and `.gitignore`. The source-of-truth instructions say to preserve the actual repository versions and not fabricate replacements. Checks that read those files cannot be considered evaluated from this archive. Restore the repository's trusted copies when working in the actual Git checkout, then rerun release hygiene and CI governance checks. The archive also lacks a Dependabot configuration; review this with the repository owner before introducing or replacing hidden `.github` files.

## Runtime and dependency verification

- Required Node runtime: `24.15.0` (`.nvmrc` and `package.json` engine agree).
- Available runtime: Node `22.16.0`; the runtime gate correctly rejects it.
- `npm ci --legacy-peer-deps` did not complete within the available execution window. The resulting `node_modules` is partial and must not be used as evidence of an install or build.
- Engine warnings were observed for the project and packages including `isomorphic-dompurify`, `jsdom`, and `undici` under Node 22.16.0. These warnings are consistent with the runtime mismatch; do not change package engines to accommodate an unsupported runtime.
- Dependency audit, full lint, project typecheck, Next.js production build, Playwright browser/device tests and bundle/performance measurements remain outstanding.

## Database and blockchain safety

- The three migrations `20261116182000_gh_research_intelligence_platform_foundation.sql`, `20261116190000_gh_media_evidence_engine.sql`, and `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` remain `REVIEW_REQUIRED` and unapplied.
- The migration inventory generator was corrected so the scoped evidence chain migration cannot be misclassified as `REQUIRED`.
- No `supabase db push`, migration repair, migration-history edit, or production schema change was performed.
- The evidence scanner provider is not deployed/configured. Evidence remains quarantined; file-signature checks are not malware scanning.
- The research geographic hierarchy has no verified populated Nigeria dataset or international data package in this source increment.
- No live Pi Testnet provider calls, wallet-signing verification, payment execution, payout execution, on-chain transaction or Mainnet operation was performed. Pi network/provider and blockchain safety claims require live Testnet evidence, independent reconciliation and explicit approval.
- Financial and wallet write authority must remain server-side, idempotent, ledger-backed, and separately tested for retries, duplicate callbacks, provider timeouts and uncertain outcomes.

## Repairs made in this audit increment

1. Added `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` to the canonical `REVIEW_REQUIRED` classification set.
2. Regenerated `VERIFIED_MANIFEST.txt`, `MIGRATION-SOURCE-MANIFEST.csv`, `docs/MIGRATION_CHECKLIST.md`, and `supabase/TESTNET_APPLY_ORDER.md` from the canonical migration directory. The resulting inventory is 229/229 and synchronized.
3. Corrected the authoritative archive filename and SHA-256 in project source-of-truth documentation.
4. Repaired `lib/server/social/rpc.ts` to pass RPC names and object arguments to the central Supabase transport, use the shared timeout budget, and consume typed `RestResult` values rather than fabricating a Response wrapper.
5. Updated social timeout regression checks to verify the centralized timeout, no-store and service-role transport contracts.
6. Updated the ecosystem registry regression test to match the actual 10 categories and 42 registered services (12 Active, 30 Coming Soon).
7. Fixed the Active Field Research service's destination from `none` to its canonical ecosystem focus destination; the registry test now verifies all Active services have a destination.
8. Added explicit `research` and `fieldOperations` owners and route prefixes for the new Research/Field mutation routes, plus the internal evidence scanner callback. All 173 mutating routes now have one declared route-level owner.

## Verification after repairs

- `scripts/check-project-truth.mjs`: 11/11 PASS.
- `scripts/check-migration-source-manifest.mjs`: 229/229 PASS.
- `scripts/check-scoped-evidence-engine.mjs`: 25/25 PASS.
- `scripts/check-media-evidence-engine.mjs`: 22/22 PASS.
- `scripts/check-security-audit-20261109.mjs`: 34/34 PASS.
- `scripts/check-social-upstream-timeouts.mjs`: 9/9 PASS.
- `scripts/check-domain-mutation-route-owners.mjs`: 173 mutating routes assigned; PASS.
- `scripts/check-run269-client-table-write-acl.mjs`: 20/20 PASS.
- `scripts/test-ecosystem-service-registry.mjs`: PASS.
- `scripts/check-phase7-social-experience.mjs`: 24/24 PASS.
- Prebuild diagnostic run: 319/358 PASS, 38 FAIL, 1 runtime gate skipped under Node 22.16.0.
- TypeScript syntax diagnostics: 170 errors in 17 files remain. Full compile/build is therefore not approved.

## Required next sequence

1. Restore the exact trusted `.gitignore` and `.github/workflows/ci.yml` from the existing Git repository; do not synthesize substitutes.
2. Repair all 17 syntax-broken TypeScript files and inspect all 34 files with suspicious Supabase transport wrappers. Preserve each RPC's exact argument contract, identity authority, ledger semantics, timeout, idempotency and error handling.
3. Run Node `24.15.0`, complete `npm ci` with the repository's intended install policy, and inspect `npm audit` findings before dependency changes.
4. Run typecheck, lint with a zero-warning release threshold, all 358 prebuild checks, static verification and production build.
5. Run Playwright tests plus real two-account privacy, identity, wallet, marketplace, messaging, field/research and accessibility acceptance on Preview/Testnet.
6. Validate all held migrations on disposable PostgreSQL, reconcile exact Testnet history, apply only individually approved migrations, then run read-only postflight checks.
7. Connect a trusted malware scanner; verify callback authentication, digest matching, retry behavior, quarantine release and evidence hash-chain continuity.
8. Complete Pi Testnet provider and wallet-flow verification, reconciliation of uncertain transactions, rate/limit checks, and independent financial controls. Keep Mainnet disabled.
9. Review performance budgets, Core Web Vitals, observability, incident response, backup/restore, retention, legal/privacy and staged rollout/rollback before any production approval.

**Conclusion:** The archive has valuable platform foundations, but it is not release-ready. Fixing compile integrity and the malformed server data-access layer is the immediate P0 work. Adding more user-facing features before that repair would increase risk and technical debt.
