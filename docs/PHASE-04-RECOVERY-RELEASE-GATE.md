# Recovery Track Phase 4 — Operational Release Gate

This Phase 4 is the next stage of the **database recovery workstream**; it is separate from the historical product Phase 4 identity-integration feature.

## What this phase adds

- One repeatable command to run the Phase 3 recovery contract, the read-only restored-catalog contract, and evidence-validator behavior tests.
- A fail-closed operational gate that requires an explicitly supplied evidence file from a real disposable PostgreSQL restore drill.
- A machine-validated evidence record that cannot pass with missing RPO/RTO, failed/not-run integrity checks, failed/not-run smoke tests, duplicate check names, invalid timestamps/timezones, malformed PostgreSQL version strings, an obviously non-independent reviewer label, or credential material (including raw database connection URLs, bearer tokens, compact JWTs, common GitHub/Stripe/AWS/chat-provider token formats, secret-bearing URL query parameters, and private keys) hidden in generic evidence fields.
- Clear separation between offline/source verification and the actual operational approval decision.

## Run the offline source contracts

```sh
node scripts/check-phase4-recovery-release-gate.mjs
```

This runs all offline tests and reports the operational gate as blocked when no evidence is supplied. To make the command fail closed for release automation, use `node scripts/check-phase4-recovery-release-gate.mjs --require-operational-evidence` (the registered npm command uses this strict mode). A blocked result is expected until a real drill has been performed; do not manufacture evidence to make the gate green.

Run `npm run test:phase4-recovery-release-gate` to verify that strict mode exits non-zero when evidence is absent, source-only mode explicitly keeps operational release blocked, malformed evidence is rejected, and symbolic-link evidence paths are refused. The validator regression suite also covers secret leakage patterns and the 256 KiB evidence size limit. CI runs these regression tests.

## Complete the operational gate

1. Use the Phase 3 runbook to verify a real backup artifact and restore it only into a disposable PostgreSQL instance. Production credentials must not be available to that environment.
2. Execute the read-only catalog validation SQL against the restored instance and record additional financial/identity invariants and application smoke tests.
3. Capture the observed PostgreSQL version, SHA-256 of the exact backup, start/finish timestamps with timezone, measured RPO/RTO, and an independent review. Keep raw logs redacted and stored in the approved evidence location.
4. Validate the evidence without putting secrets in the environment variable or command line:

```sh
GH_RESTORE_EVIDENCE_PATH=/secure/path/restore-evidence.json node scripts/check-phase4-recovery-release-gate.mjs --require-operational-evidence
```

The path shown is an example only. Use the actual approved path on the operator host. Do not commit evidence that includes personal data, credentials, database URLs, or secrets.

## Release blockers that source checks cannot clear

- Actual restore rehearsal and catalog query execution.
- Provider PITR/backup retention confirmation and a tested recovery point.
- Migration history reconciliation against the target environment and replay into a clean disposable database.
- Synthetic ledger/payment/transfer invariants and rollback-safe application smoke tests.
- Independent review of redacted logs and measured RPO/RTO against owner-approved objectives.
- Production build, typecheck, lint, and browser E2E under the repository-required Node.js version (`.nvmrc`).

No production database or migration is modified by this gate. Passing its evidence validator means the record is structurally complete and reports passing checks; it does not cryptographically attest to the truth of the operator's claims.

## CI coverage and release semantics

The Node.js 24.15.0 CI job runs the Phase 3 source contracts, the read-only catalog-gate contract, the restore-evidence regression suite, this Phase 4 source-only gate, and the existing product Phase 4 identity-integration contract. These checks protect source behavior; they do not establish that a backup can be restored.

A release candidate must separately run this gate with `--require-operational-evidence` and `GH_RESTORE_EVIDENCE_PATH` pointing to the redacted evidence from a successful restore rehearsal in a disposable, isolated PostgreSQL environment. The evidence file must not contain credentials or production secrets. A missing or invalid evidence file is a release blocker. Evidence symlinks are rejected to prevent validation from silently following a mutable or redirected path. The validator opens evidence with no-follow protection where supported, checks the opened descriptor identity against preflight metadata, enforces the size cap on that descriptor, and reads from the same descriptor to reduce time-of-check/time-of-use races. Child verification processes have explicit timeouts so a hung check cannot stall the release gate indefinitely. Never use production credentials or restore into production for this rehearsal.

The current development environment did not have Node.js 24.15.0 or PostgreSQL restore tools available, so a supported-runtime build/typecheck/lint and a real restore rehearsal are not represented as passed by this source update. CI is pinned to Node.js 24.15.0 and must supply those runtime checks.



### Evidence secret scanning

The offline evidence validator rejects credential-shaped field names, database connection URLs, URL userinfo credentials, bearer tokens, compact JWTs, common GitHub/Stripe/AWS/chat-provider token formats, secret-bearing URL query parameters, and private-key markers even when accidental material is placed in a generic operator note. Evidence must contain only redacted metadata; never include credentials, tokens, or private key material. Regression tests cover these patterns.
