# GreenHaven RUN324 — Phase 2 examination/election workflows and Phase 3 quality hardening

**Baseline:** `GREENHAVEN-0.338.99-RUN323-PHASE2-HARDENING-PHASE3-START.zip`  
**Package:** `gh-connect@0.338.99` (unchanged)  
**Disposition:** local source candidate only; not deployed, not production-approved.

## Phase 2 source implementation in this run

### Timed examinations

- Examination projects now accept a bounded server-owned configuration: duration, attempt limit, pass mark, randomized question order/choice order, and manual or immediate result release.
- Answer keys and point values are stored in the private project form schema and removed from the public form projection. The legacy public survey-submit route explicitly rejects examination projects, preventing the non-timed submission path from bypassing the exam workflow.
- Public exam respondents use a high-entropy browser session key. The server stores only an HMAC-SHA-256 digest using the dedicated `RESEARCH_EXAM_HASH_SECRET` (minimum 32 characters); raw respondent keys are not stored in the attempt row.
- Server-created deadlines, attempt ceilings, start/resume, saved progress, answer validation, server-side scoring and withheld-by-default results are implemented. The browser persists the session key in session storage so an unfinished attempt can be resumed after a page reload in that browser session.
- Research Studio has an owner-only attempt review screen with explicit review, release and void transitions. Respondent identifiers are not returned to the UI. After a manual release, the respondent can retrieve the result using the same hashed session identity.
- Conditional branching is intentionally rejected for timed exams in this increment; supported exam items are short/long text metadata and single-answer choice/dropdown scoring questions.

### Election-observation administration

- Owner-scoped contest listing/creation and guarded status transitions (`draft → active → closed → archived`) are implemented for election-observation projects only.
- Candidate creation and activation changes are owner-scoped and draft-only; ballot order, names, party labels and external references are bounded.
- Field-agent assignments validate user identity, role, date windows and active project membership. Assignment listing is available to the project owner.
- Research Studio now exposes contest, candidate and field-agent administration, with clear wording that the screen does not certify election results.

## Phase 3 source quality work

- Marketplace query normalization is shared by persisted filters and live search; quantity caps are integer-safe and bounded.
- Community polls sanitize malformed option collections and vote counts, prevent aggregate integer overflow, constrain percentages, disable unavailable voting controls and expose accessible vote progress semantics.
- Feed, profile and community post cards now share safe non-negative integer normalization for upvote/downvote totals, including aggregate sentiment calculations; this preserves the canonical shared `EnhancedPostCard` surface.
- These are focused reliability/accessibility upgrades, not a claim that every Phase 3 product transformation workstream is finished.

## Verification

- Phase 2 examination/election source contract: 22/22.
- Research membership API source contract: 13/13.
- Field-intake hardening: 7/7.
- Research integrity hardening: 12/12.
- Phase 3 marketplace search quality: 6/6.
- Phase 3 community poll accessibility: 10/10.
- Phase 3 post engagement count hardening: 6/6; shared count helper runtime: 9/9.
- Existing active-module runtime suite: 58/58 across 11 modules.
- Changed TypeScript/TSX syntax transpilation: 10/10 files, zero syntax diagnostics.
- Phase 10 release closure contract: 17/17 after restoring the canonical prebuild runner and registering the required gates.
- Full `npm run verify:static`: PASS (exit 0) after classifying the active Run 319–321 engineering records in the documentation allowlist.
- The separate `npm run prebuild:checks` execution reached the JSX duplicate-props checker and stopped because the project dependency `typescript` is not installed in this workspace. This is an environment/dependency blocker, not a passed prebuild. The canonical prebuild runner also enforces Node 24.15.0, while this workspace is Node 22.16.0.

## Remaining hard blockers — do not mark operationally complete

1. The Research Intelligence migration `20261116182000_gh_research_intelligence_platform_foundation.sql` remains REVIEW_REQUIRED and unapplied. Membership, exam attempts, election contests, candidates and assignments cannot be live-tested until migration history is reconciled, the migration is reviewed, rehearsed on disposable PostgreSQL and separately approved for Testnet.
2. Election tally submission and candidate-vote rows require an atomic database RPC and concurrency/reconciliation tests. They are not implemented in this run; no non-atomic parent/child REST writes were introduced.
3. Geographic source data is not seeded. Country/state/LGA/ward/polling-unit references remain unavailable until authoritative datasets are reconciled and imported.
4. The evidence scanner provider/worker and its secret are still operator prerequisites. Evidence remains quarantine-first; this work does not claim malware scanning is operational.
5. Node 24.15.0 and a complete locked dependency install are required for full typecheck, lint and production build. This workspace has Node 22.16.0 and no installed project dependency tree, so those checks are blocked rather than passed.
6. Real Pi Browser sign-in, public browser acceptance, database behavior, exam concurrency/timeout behavior and election workflow acceptance require Testnet/device verification.

## Safety boundary

No GitHub push, Vercel deployment, Supabase migration, live database mutation, wallet/payment operation, user-account mutation, PIN change or Mainnet action occurred. The Testnet and Mainnet databases were not changed. Production remains **NOT APPROVED**.
