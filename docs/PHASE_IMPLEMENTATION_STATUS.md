# Feature and phase status policy

This document is a status vocabulary, not a claim that every feature or phase is live-ready. Use [`PROJECT_TRUTH.md`](PROJECT_TRUTH.md) as the current release authority.

## Status vocabulary

| Status | Meaning |
|---|---|
| **Source present** | Relevant code, migrations, and/or documentation exist in the repository. |
| **Source checks passed** | The named automated checks passed for the stated commit/environment. |
| **Testnet verified** | Runtime behavior was exercised against the identified Testnet services with recorded evidence. |
| **Production approved** | Required release gates passed and an authorized operator recorded approval. |

These statuses are not interchangeable. A source implementation, migration file, or static regression test does not prove remote schema state, payment completion, provider settlement, privacy behavior, or production readiness.

## Current status

The current package version is `0.70.3`. The supplied source has passed the repository static hardening gates used in this release reconstruction. Production/Testnet release is not approved and remains blocked until a disposable PostgreSQL clean-install and the required live evidence gates are completed. See [`PROJECT_TRUTH.md`](PROJECT_TRUTH.md) for the current gate table and next actions.

Older phase reports are retained under [`archive/`](archive/) for historical context only. Do not use their version numbers, migration counts, or test totals as current evidence.
