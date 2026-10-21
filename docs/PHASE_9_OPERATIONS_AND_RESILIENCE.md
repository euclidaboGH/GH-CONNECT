# Phase 9 — Operations and Resilience

**Project:** GH-CONNECT / GreenHaven 0.63.25  
**Scope:** Health probes, fail-closed release policy, incident response, recovery discipline and operational evidence.  
**Remote change policy:** No Supabase, Vercel, Pi, Paystack, or other remote service was accessed or modified.

## Source changes

- Added a Phase 9 regression suite and included it in `ci:verify`.
- Audited the distinction between `/api/health` (readiness) and `/api/health/live` (process liveness). Readiness must be dynamic, non-cacheable, and use its computed HTTP status; liveness remains independent of database/provider configuration so transient dependency issues do not cause platform restart loops.
- Reviewed the release policy: it remains `not_release_approved`, keeps financial features disabled, and requires backup/restore rehearsal, kill-switch verification, Testnet evidence, and operator approval.
- Corrected the existing mainnet readiness snapshot so it cannot be interpreted as deployment authorization before evidence exists.
- Added an operations runbook covering incident classification, safe triage, provider/financial reconciliation, recovery, and release/rollback discipline.
- Added a hash-verified release-evidence validator shared with Phase 10. It rejects missing evidence, checksum drift, path traversal, secret-like values, unknown/missing gates, unapproved reviewers, unresolved risks, and attempts to use the Testnet validator for Mainnet.
- Added an offline evidence-packet template generator that refuses to overwrite an existing packet; no deployment or remote system is touched.

## Incident response baseline

### Severity

- **SEV-1:** suspected unauthorized access, cross-account data exposure, ledger corruption, duplicate/incorrect settled payments, secret exposure, or broad production outage. Stop affected feature paths using an approved kill switch, preserve evidence, and escalate to the accountable security/finance/operator owners.
- **SEV-2:** major user-facing degradation, payment provider failures with recoverable durable intents, widespread messaging/media failure, or repeated elevated errors. Freeze risky rollout and investigate with redacted logs and correlation IDs.
- **SEV-3:** isolated non-financial defect with a safe workaround. Track, assign an owner, and fix through reviewed source changes.

### First response

1. Establish affected environment and network (Preview/Testnet versus Production/Mainnet) before taking action.
2. Capture deployment identifier, UTC timestamps, request/correlation IDs, health/readiness output and redacted errors. Never copy secrets, raw payment payloads, session tokens, full wallet identifiers, or unnecessary personal data into tickets.
3. For financial symptoms, stop retries that could create new side effects; inspect durable intent and provider state before any retry, refund, or reversal. Do not infer payment success from the client redirect or a UI toast.
4. For authorization/privacy symptoms, disable the affected entry point and preserve audit evidence. Do not weaken RLS or bypass membership checks to restore availability.
5. Prefer rollback to a known-good application revision when safe. Do not delete tables, truncate ledgers, or rewrite payment history as an application rollback technique.

### Recovery and resilience gates

- Before release, an operator must prove a database backup can be restored into an isolated target and validate key counts/invariants.
- Every migration needs a forward-recovery plan and a statement of whether downgrade is safe. Destructive rollback is not assumed.
- Financial recovery requires provider-side reconciliation, durable intent/idempotency inspection, and a reviewed correction/refund path; no manual ledger edits without an auditable, approved procedure.
- Feature flags must be tested as kill switches, including confirmation that disabling a feature does not strand funds or discard durable work.
- Monitor health/readiness, error rates, payment approvals/completions, reconciliation backlog, message delivery, media failures and authentication failures during rollout.
- Keep Testnet and Mainnet credentials, databases and release evidence separate.

## Verification results

| Check | Result |
|---|---:|
| Phase 9 operations/resilience assertions | 19/19 passed |
| Phase 8 architecture-quality assertions | 23/23 passed |
| Phase 7 product-experience assertions | 26/26 passed |
| Phase 6 media/messaging/realtime assertions | 16/16 passed |
| Phase 5 financial-integrity assertions | 11/11 passed |
| Project integrity audit | 36 passed, 0 errors, 0 warnings |
| Dependency lock consistency | Passed |
| Release evidence validator regression tests | 22/22 passed |
| JSX safety | 710 files scanned, passed |

These are source-level checks. They do not prove that alerting is configured, backups exist, a restore succeeds, a provider sandbox works, or live deployment behavior is correct. The available Node `22.16.0` runtime is below the project-supported `^22.22.2` / `^24.15.0` range; the runtime guard rejects it, so clean install, typecheck, lint and production build remain unverified.

## Evidence integrity improvements

Release evidence must be stored as sanitized artifacts and referenced by relative path plus SHA-256 digest. The validator checks that artifacts exist and still match their recorded hashes, rejects path traversal and common credential/token patterns, requires all mandatory gates to pass, and requires named engineering, security, operations, and finance/product reviewers. It accepts only the `testnet-preview` release target. This is a structural integrity control, not a substitute for human evidence review or live tests.

## Open release gates

- Run clean dependency installation, typecheck, lint, and production build under Node 24.15.0.
- Exercise readiness/liveness endpoints in a running deployment and verify monitoring/alert routing.
- Conduct an isolated database restore rehearsal and record evidence.
- Perform authenticated two-account Testnet flows, provider sandbox payment/reconciliation, and security tests.
- Obtain accountable operator approval before any Mainnet release.

## Exit decision

**Phase 9 source work is delivered; operational readiness is not certified.** Phase 10 remains Testnet beta and launch approval, with remote deployment and verification deferred as requested.
