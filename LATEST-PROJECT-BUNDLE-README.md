# GreenHaven / GH-CONNECT — Full Project Bundle

Baseline: **0.338.54**  
Bundle date: **2026-11-11**

This is the complete source project assembled from the 0.338.53 Active Module Filters Phase 1 source archive, with the Run #291 payout-recovery safety correction and postbuild footprint diagnostics applied.

## Included latest source work

- Run #291: self-service Pi earnings reservation release is restricted to requests that provably never started provider execution; processing/uncertain requests remain held for authoritative provider reconciliation. Added 15 focused regression checks.
- Run #291: added non-blocking postbuild workspace-footprint diagnostics to identify large directories/files in the Vercel build workspace.

- Shared responsive filter workspace integrated across the 11 Active modules: Community, GH Chat, Connections, Matches, Marketplace, Orders, Wallet, GHC, Pi Payments, Rewards and Membership.
- Restored `scripts/check-phase1-12-engagement-reliability.mjs`, which was referenced by `prebuild:checks` but missing from the CI checkout.
- Updated the engagement regression assertion to match the implemented notification request-array flow.
- Updated the legacy Phase 12 verification fixture with a clearly labelled 0.338.53 baseline reference, without changing its historical content or claiming release approval.

## Focused verification performed for this bundle

- Engagement reliability regression: 16/16
- Phase 10 release closure: 16/16
- Phase 10 platform acceptance: 24/24
- Phase 24 final release review: PASS
- Release hygiene: 15/15
- Project truth: 11/11
- Migration source manifest: 221/221
- Active module filter panel contracts: 14/14

## Important release and verification boundaries

- Production remains **NOT APPROVED**.
- Pi-funded GHC acquisition, paid business checkout, withdrawals, payouts and other financially sensitive execution paths remain gated.
- No database migration was applied, no database push was run, and no live financial transaction was executed.
- The 0.338.53 baseline is now verified by successful Vercel Preview builds on both connected projects (Node 24.22.2, 315 prebuild checks invoked). The new 0.338.54 Run #291 changes have not yet been pushed or preview-built. The connected GitHub integration rejected branch creation with HTTP 403, so no remote refs/commits or PRs were changed.
- Run #291 payout-recovery safety contract passes 15/15 locally. The postbuild footprint reporter has been exercised against the source tree; the next Vercel build must capture its postbuild directory/file measurements. Full Node 24 validation for the new increment and real Android/Pi Browser/desktop visual acceptance remain outstanding.
- Use Node.js **24.15.0**, as pinned by the project, for the full CI/build workflow.

## Recommended next verification

From the project root, run:

```bash
node scripts/check-phase1-12-engagement-reliability.mjs
node scripts/check-phase10-release-closure.mjs
node scripts/check-phase10-platform-acceptance.mjs
node scripts/check-phase24-release-review.mjs
node scripts/check-release-hygiene.mjs
node scripts/check-project-truth.mjs
node scripts/check-migration-source-manifest.mjs
node scripts/check-active-module-filter-panels.mjs
npm run verify:static
npm run prebuild
npm run typecheck
npm run lint
npm run build
```

Run the complete workflow under Node 24.15.0 with dependencies installed from the committed lockfile.
