# GreenHaven RUN322 — Phase 1 source closeout and Phase 2 start

Baseline: `GREENHAVEN-0.338.99-RUN321-PHASE1-PUBLIC-AUTH-BOUNDARY.zip`

## Phase 1 status

The source implementation is complete for the route boundary and diagnostics:

- `/r/:slug` and exact `/field` render outside Pi/identity/session providers.
- `/field/studio`, `/field/admin/**`, and member routes remain authenticated.
- Pi SDK is no longer globally injected from the root layout; authenticated runtime retains on-demand loading.
- Public route boundary static check: 12/12.
- Public route behavior check: 10/10.
- Pi authentication reliability source contract: 11/11.

External exit gates remain open: Node `^24.15.0` dependency-backed typecheck/lint/build and real Pi Browser Testnet acceptance for new/returning Pioneer onboarding. This environment only has Node 22.16.0 and no `node_modules`; no real Pi Browser device is attached. The Pioneer incident is therefore not certified resolved.

## Phase 2 source changes

1. Public survey submission keys now require `crypto.getRandomValues`; the insecure `Math.random()` fallback has been removed. If secure randomness is unavailable, the form fails closed with a user-readable message.
2. Public response completion no longer reports success if the evidence lookup or binding write fails. It returns a retryable 503 and verifies the final response/evidence association before acknowledging receipt. Repeating the same submission key can reconcile a previously saved response safely.
3. Research Intelligence migration adds database-level integrity:
   - geographic unit level must exist for its country;
   - parent geographic unit must be in the same country;
   - contest geographic unit must match the contest country;
   - tally contest must belong to the same research project.
4. Evidence chain migration explicitly declares its `pgcrypto` dependency before calling `extensions.digest()`.
5. Added `scripts/check-phase2-research-integrity-hardening.mjs` and wired it into `prebuild` and `verify:static`.
6. Regenerated the migration inventory and synchronized checklist/Testnet apply-order artifacts.

## Verification

- Phase 2 Research Integrity hardening: 12/12.
- Phase 1 public route boundary: 12/12.
- Public route behavior: 10/10.
- Pi auth reliability contract: 11/11.
- Field Research foundation: 23/23.
- Research Intelligence foundation: 20/20.
- Media Evidence Engine: 22/22.
- Scoped Evidence Engine: 25/25.
- Evidence file signatures: 16/16.
- Research logic: 8/8.
- Ecosystem coverage: 15/15 (42 services × 30 objectives).
- Supabase client contract: 13/13.
- Migration source manifest: 229/229; clean canonical migration inventory: 229 unique 14-digit migrations.

These are source/static and pure-logic checks. No disposable PostgreSQL rehearsal, Node 24 typecheck/lint/build, live browser test, scanner integration, or database migration was performed.

## Phase 2 remaining work

- Timed exam start/resume, server-clock deadline enforcement, attempt limits, randomized question/choice order, autosave, scoring, appeals and result release are not yet wired to public APIs/UI. The current Research Studio UI correctly labels timed delivery/automatic scoring as not enabled.
- Election contest/candidate/agent assignment/tally management APIs and screens remain incomplete.
- Project role invitation/acceptance/revocation and granular role checks remain incomplete; membership schema alone is not authorization.
- Geographic datasets have not been imported. Nigeria source discrepancies documented in RUN0.338.89 remain unresolved; no synthetic data was seeded.
- Trusted malware scanner is not configured. Evidence remains quarantined until a trusted scanner returns a valid HMAC-authenticated clean result.
- All three research/evidence migrations remain `REVIEW_REQUIRED` and unapplied. They must be rehearsed on disposable PostgreSQL and reconciled against the exact target migration history before separate operator approval.

## Safety boundary

No GitHub push, Vercel deployment, Supabase migration, wallet or payment operation, user-account mutation, PIN change, or Mainnet action was performed. Mainnet remains untouched.
