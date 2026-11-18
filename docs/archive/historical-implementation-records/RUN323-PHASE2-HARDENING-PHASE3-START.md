# GreenHaven RUN323 — Phase 2 hardening and Phase 3 start

Baseline: `GREENHAVEN-0.338.99-RUN322-PHASE1-CLOSEOUT-PHASE2-HARDENING.zip`
Package version remains `0.338.99`; this is a source-work archive, not a production release.

## Phase 2 source work in this run

1. Production field-report persistence now fails closed when durable Supabase storage is not configured. Process-local report buffering is retained only for non-production development; production cannot acknowledge an ephemeral report that may disappear on instance restart.
2. Field report API rejects unknown report kinds rather than silently converting them to `general`.
3. Field unlock, public research submission and public evidence-intent rate limits now use the platform-provided `x-real-ip` header only. Caller-controlled `x-forwarded-for` is not accepted as the rate-limit identity. Invalid/missing platform IP values collapse to a bounded `unknown` bucket.
4. Added Research Studio team-member lifecycle APIs:
   - owner-only member listing and invitations;
   - least-privilege invite roles (`editor`, `reviewer`, `field_agent`); no API path can grant `owner`;
   - duplicate active/pending invitations are rejected rather than overwritten;
   - revoked membership can be re-invited with a status-guarded update;
   - invited user can accept only their own invitation;
   - owner can suspend, revoke, reactivate or change a member role;
   - acceptance is conditionally updated against `status=invited` to prevent revoke/accept races;
   - private no-store responses and durable rate limiting.
5. Added regression scripts for field-intake safety and membership API boundaries, registered in `prebuild` and `verify:static`.

## Phase 3 source work in this run

1. Marketplace search now normalizes Unicode (NFKC), removes control characters, collapses whitespace and bounds query length to 100 characters. The same canonical helper is used for persisted account-scoped filters and live search input; server-side filtering remains authoritative.
2. Marketplace quantity cap now always returns a safe integer, clamps finite caps to 1–999, and uses a safe default for invalid caps. This prevents decimal or `NaN` caps from entering cart quantity calculations.
3. Community polls normalize untrusted vote counts, constrain percentages to finite 0–100 values, disable controls when no vote handler is available, and expose `aria-pressed` and descriptive accessible labels.
4. Added Phase 3 marketplace-search and community-poll regression gates to `prebuild` and `verify:static`.

## Verification performed

- Phase 1 public route boundary: 12/12.
- Public route policy behavior: 10/10.
- Pi authentication reliability contract: 11/11.
- Phase 2 research integrity hardening: 12/12.
- Phase 2 field intake hardening: 7/7.
- Phase 2 research membership API: 13/13.
- Field Research foundation: 23/23.
- Research Intelligence foundation: 20/20.
- Research Intelligence pure logic: 8/8.
- Phase 3 marketplace search quality: 6/6.
- Phase 3 community poll accessibility: 6/6.
- Active module runtime tests: 58/58.
- Creator/media hardening: 13/13.
- Upload cancellation and identity guard: 12/12.
- Creator draft recovery: 11/11.
- Durable media URL source gate: 7/7; runtime assertions: 19/19.
- Upload recovery reliability: 9/9.
- Ecosystem thirty-track coverage: 15/15 (42 services × 30 objectives = 1,260 scoped objectives).
- SQL lexical integrity: 229 migrations passed.
- Migration source manifest: 229/229; canonical migration inventory clean.
- Held migration readiness source checks: 6/6; disposable PostgreSQL rehearsal remains required.
- Project truth: 11/11.
- Release hygiene: 17/17.
- Release gate hardening: 20/20.
- Changed TypeScript/TSX syntax transpilation: 10/10.

## Important unresolved release gates

This run does **not** certify Phase 2 as operationally complete. The following work remains explicitly gated:

- The three Research Intelligence / Media Evidence / Evidence Chain migrations remain `REVIEW_REQUIRED` and unapplied. The new membership endpoints depend on `gh_research_members` from the held Research Intelligence migration and will return unavailable until the reviewed migration is separately approved and applied to Testnet.
- Timed exam start/resume, server-clock deadlines, attempt limits, randomized question/choice order, autosave, scoring, appeals and result release are not yet wired end-to-end.
- Election contest/candidate/agent assignment/tally management APIs and screens are not yet complete.
- Geographic source datasets remain unseeded pending verified country-specific source reconciliation.
- Trusted malware scanner integration remains an operator prerequisite; evidence remains quarantine-first until a trusted scanner attests clean.
- Full project typecheck/lint/build was not completed because dependencies are not installed in this working copy. The required project Node engine is `^24.15.0`; the shell has Node `22.16.0`, and the available bundled runtime is Node `24.11.1`, below the minimum.
- Real Pi Browser sign-in/onboarding and cross-browser public survey/field acceptance remain external device gates.

## Safety boundary

No GitHub push, Vercel deployment, Supabase migration, live database mutation, wallet/payment operation, user-account mutation, PIN change or Mainnet action was performed. The archive is for review and controlled Testnet preparation only. Production remains NOT APPROVED.
