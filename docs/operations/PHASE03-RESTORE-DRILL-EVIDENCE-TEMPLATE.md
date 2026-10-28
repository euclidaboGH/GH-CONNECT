# Phase 3 — isolated restore drill evidence

> Fill this record during an approved operator-led drill. Do not include credentials, personal data, raw connection strings, or production dump contents. This template is not evidence that a drill has occurred.

## Run metadata

- Change/ticket reference:
- Date/time started (UTC):
- Date/time completed (UTC):
- Operator:
- Independent reviewer:
- Target environment identifier (disposable only):
- PostgreSQL major/minor version:
- Required extensions and versions:

## Backup artifact

- Backup identifier (no secrets):
- Backup timestamp (UTC):
- Backup size in bytes:
- SHA-256:
- `verify-database-backup-artifact.mjs` result and captured log location:
- `pg_restore --list` result:
- Encryption/access-control/retention confirmation:

## Restore and validation

- Restore command/runbook version (credentials redacted):
- Restore start/end timestamps (UTC):
- Restore exit status:
- Errors or warnings:
- Schema/table/function/index counts before and after:
- RLS policy and security-definer ACL/search_path checks:
- Foreign-key and unique-constraint validation:
- Synthetic ledger/payment/transfer reconciliation results:
- Application smoke-test results:
- Cleanup of disposable environment confirmed by:

## Recovery objectives

- Approved RPO target:
- Observed backup age / data-loss window:
- Approved RTO target:
- Measured elapsed recovery time:
- Target met? If not, remediation owner and due date:

## Decision

- [ ] PASS — all mandatory checks completed and evidence reviewed
- [ ] FAIL — service recovery is not demonstrated
- [ ] INCOMPLETE — missing evidence; do not claim recovery readiness

Exceptions, remediation, reviewer comments, and approval:


