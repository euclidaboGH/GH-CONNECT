# GREENHAVEN PHASE 34 — REPUTATION + CURATION INTELLIGENCE V2

## Scope

Phase 34 upgrades reputation and curation from a basic points + weighted-vote system into a server-authoritative trust/intelligence layer.

### Implemented

- Five internal trust dimensions persisted as a durable intelligence snapshot:
  - Creator Quality (CQS)
  - Judgment Calibration (JCS)
  - Community Integrity (CIS)
  - Economic Value (EVS, descriptive only)
  - Growth XP
- Durable Curation Power snapshot derived from server-owned reputation/calibration/integrity/activity evidence.
- Durable curator activity audit stream.
- Daily curation mutation cap (120/day).
- Rapid-activity detection.
- Same-author concentration detection.
- Server-side curation risk score.
- Curation preflight authorization for:
  - deleted/missing posts
  - self-curation
  - blocked relationships
  - followers-only visibility
  - unsupported visibility
  - daily-volume abuse
  - concentrated/rapid activity
- V2 guard is inside the atomic curation transaction, so preflight is not merely a UI check.
- Curation activity is recorded only after the durable vote/reward/active-weight pipeline succeeds; transaction rollback removes the audit event when the mutation fails.
- Existing active-weight SET semantics remain authoritative; changing a vote does not accumulate weight.
- Weighted curation now prefers the durable V2 intelligence snapshot and retains the existing pure formula as a staged-migration fallback.
- Authenticated `/api/social/reputation/intelligence` endpoint.
- Public intelligence projection deliberately excludes risk internals and wallet/financial balances.
- No new GHC minting path.
- GHC balance remains excluded from curation power.

## Database

- Clean migration count: **128**
- Executable GreenHaven tables: **111**
- New migration:
  - `20261023030002_gh_reputation_curation_intelligence_v2.sql`
- Canonical installer regenerated from all 128 migrations.

## Verification

- Phase 34 contract: **18/18**
- Phase 33 regression: **24/24**
- Phase 32 regression: **20/20**
- Phase 30 regression: **17/17**
- Migration release readiness: PASS
- Project integrity: **36/36**, 0 errors, 0 warnings
- Database source contract: **111 tables / 128 migrations**

## Runtime limitation

The extracted source workspace does not contain `node_modules`, and the available container runtime is Node 22 while the project pins Node 24.15.0. Therefore this phase does not claim a genuine Next.js build, TypeScript compilation, browser E2E, live Supabase execution, Vercel deployment, or Pi Testnet verification.

## Safety

This phase does not create an inflationary reward mechanism. Reputation is not wallet balance, curation power is not purchased with GHC, and the new intelligence layer cannot directly mutate the financial ledger.

## Remaining roadmap

35. GH Pulse + Media Platform
36. Security, Privacy & Abuse Hardening
37. Performance + Mobile/Pi Browser Optimization
38. Accessibility + World-Class UX Consistency
39. Database & Backend Final Convergence
40. Automated Testing & Regression Fortress
41. Production Build + Vercel Repair
42. Pi Testnet E2E
43. Global Beta Readiness
44. Pi Ecosystem Compliance + Production Release Audit
