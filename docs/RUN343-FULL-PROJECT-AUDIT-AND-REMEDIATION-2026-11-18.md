# GH-CONNECT Full-Project Audit & Remediation Report — RUN343
Date: 2026-11-18
Baseline: `GREENHAVEN-0.338.99-RUN342-PI-AUTH-SCOPE-FIELD-RESEARCH-ISOLATION.zip`
Package: `gh-connect@0.338.99`
Disposition: **NOT APPROVED for production** pending the verification gates below.

## Scope and evidence
This audit used the exact user-designated source archive as the baseline. No live Supabase database was mutated, no migration was applied, no GitHub push or Vercel deployment was performed, and no Pi/payment/payout/blockchain transaction was initiated.

- Archive entries: 3,260.
- Canonical migration SQL files found: 230.
- Package version: 0.338.99.
- `.gitignore` and `.github/workflows/ci.yml` are present in this baseline (unlike the earlier 0.338.92 audit baseline).
- The repository's `npm run verify:static` command was executed under Node 22.16.0. The command completed through the registered static/runtime contract suite; its output includes passing gates for Pi auth scope isolation/reliability, project truth, migration manifest, evidence chain, route ownership, feed privacy, identity boundaries, browser-safe crypto and release checks. This is not a supported Node 24.15.0 dependency-backed production build.
- `node_modules` is absent. `tsc --noEmit` therefore reports missing React/Next/type packages and cannot be used as a valid project typecheck. Do not interpret dependency-resolution errors as confirmed application type errors or as a passing typecheck.

## Highest-priority findings

### P0 — Production verification remains incomplete
A source-only check suite is not evidence of a successful install, production build, deployment, live database compatibility, or Pi Browser authentication. The latest reported user-facing failure is `PI_AUTHENTICATE_FAILED` in Pi Browser Preview/Testnet, where the authorization prompt does not appear. The root cause remains unconfirmed because no matching client diagnostic/event payload or live reproduction trace was supplied. A confirmed recovery weakness was found: if the SDK authentication promise never settles, the provider in-flight guard remains locked and a later Retry tap can be ignored. RUN343 now bounds the Pi.authenticate wait to 25 seconds, emits the token-free `PI_AUTH_PROMPT_TIMEOUT` diagnostic, releases the provider attempt path after timeout, and queues a manual Retry tap made during an active attempt instead of silently discarding it. The queued attempt starts only after the current attempt unwinds, preserving single-flight behavior. This is a retry-reliability fix, not proof that the authorization prompt itself now appears. Live Pi Browser verification and durable server session confirmation remain required.

### P0 — Database state must be reconciled before migrations
There are 230 canonical migration files in this archive. Source inventory alone cannot establish which migrations are applied to the connected Supabase Testnet or whether the database schema matches the source. Reconcile migration IDs and schema read-only against the actual target before applying anything. Review-required migrations must remain unapplied until individually reviewed, tested against a disposable database, and approved. Never repair history by inserting/deleting migration ledger rows without evidence.

### P0 — Financial authority and Pi payment boundaries
Keep A2U, GHC withdrawal, Paystack transfers, reward settlement and any automatic execution fail-closed unless the corresponding Testnet end-to-end, idempotency, concurrency, reconciliation and uncertain-outcome tests pass. Do not infer transaction success from a browser response. Verify durable ledger/provider records and use a read-only reconciliation before any retry after an uncertain result.

### P1 — Dependency-backed build and security audit
Run the project under its declared Node 24.15.0 runtime with the lockfile and intended npm install flags. Required gates: deterministic install, TypeScript, lint, complete prebuild/static checks, production Next.js build, `npm audit`/dependency report, and Playwright/browser checks. Preserve package versions unless a specific vulnerability or compatibility defect is confirmed and a pinned, tested replacement is available.

### P1 — Runtime integration and identity boundaries
Perform two-account acceptance testing for login/logout/account switching, feed visibility, follows/blocks/mutes, private media signed URL refresh, messaging, notifications, marketplace orders, research submissions, evidence review and session expiry. Confirm that APIs derive identity from the authenticated server session, apply authorization before data access, return private no-store responses where appropriate, and fail closed if visibility/privacy dependencies fail.

### P1 — Evidence intake and malware scanning
The code's file-signature/MIME checks are not a malware scan. Keep evidence quarantined until a trusted scanner returns a digest-matched clean result and the callback authentication, retry/idempotency, and chain-of-custody behavior are verified. Validate evidence upload limits, storage policies, signed URL expiry and admin review authorization.

### P1 — CI/release governance
Preserve the repository's current `.github/workflows/ci.yml` and `.gitignore`; do not overwrite them with generated substitutes. Verify workflow permissions are least-privilege, action references are immutable, secrets are not exposed to untrusted PRs, and release jobs require all build/security gates. Verify Vercel Preview and Production target the intended branch and environment, with rollback artifacts available.

### P2 — Performance, accessibility and operations
The source includes performance/accessibility checks, but real-device performance and browser acceptance are still required. Measure Core Web Vitals on representative Android/Pi Browser devices, test reduced motion, keyboard focus, safe areas, offline recovery, large feeds/media, and account transitions. Confirm alerting, log redaction, backup/restore rehearsal, retention/deletion behavior, incident response and staged rollback procedures.

## Actions completed in this audit pass
1. Re-opened and inspected the exact authoritative archive.
2. Ran the repository's `npm run verify:static` gate suite in the available Node 22.16.0 environment.
3. Verified the baseline package version, canonical migration file count, and presence of repository CI/ignore metadata.
4. Added a bounded timeout and safe diagnostic for a Pi SDK authentication call that otherwise could remain pending indefinitely; manual Retry taps during a busy attempt are now queued and drained after the attempt settles. Mandatory server-side access-token verification and least-privilege username scope are preserved.
5. Added `scripts/check-run343-pi-auth-timeout.mjs` and wired it into both the static verification and prebuild check lists.
6. Passed the new timeout/retry regression check (8/8), RUN342 Pi scope-isolation check (6/6), RUN302 Pi withdrawal hardening check (35/35), and RUN247 build diagnostics check (15/15).

No database schema, secrets, environment variables, dependency versions, or deployment settings were changed. The timeout change is narrowly scoped; without a supported dependency-backed build, live database state, and a live Pi trace, broader rewrites would risk breaking authentication, financial controls, or data access without proving a fix.

## Release gate checklist
- [ ] Node 24.15.0 deterministic dependency install succeeds.
- [ ] TypeScript and lint pass with release-appropriate warning threshold.
- [ ] Complete prebuild and static gates pass on the exact release commit.
- [ ] Production build completes and build artifacts are inspected.
- [ ] Dependency/security audit is reviewed and remediated.
- [ ] Playwright and mobile/Pi Browser end-to-end acceptance pass.
- [ ] Pi Testnet authorization prompt appears; Pi token is verified server-side; session persists and survives refresh/account switch correctly. Timeout recovery is covered by the RUN343 regression check, but the prompt itself is still unverified live.
- [ ] Supabase Testnet migration history/schema are reconciled read-only; every migration to apply is approved and verified after application.
- [ ] Financial flows are tested for idempotency, concurrent requests, callback replay, timeouts and reconciliation; Mainnet stays disabled.
- [ ] Evidence scanner is configured and quarantine release is verified.
- [ ] Vercel Preview deployment is tested against the exact release commit; rollback plan is ready.
- [ ] Independent operator acceptance approves production.

**Conclusion:** Static regression coverage is broad and the source baseline contains substantial safeguards. Production readiness is still unproven. Prioritize the live Pi authentication blocker and reproducible Node 24.15.0 build, then reconcile database and provider state before deployment. Avoid adding new features until these release blockers are cleared.
