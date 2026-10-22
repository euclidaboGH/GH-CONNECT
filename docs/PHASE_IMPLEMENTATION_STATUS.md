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

The current package version is `0.69.3`. The latest supplied Vercel build log for `testnet` commit `a04ebff` failed TypeScript checking at `contexts/ghc-context.tsx:2450` because `domains` is referenced before its declaration. Production release is not approved. See [`PROJECT_TRUTH.md`](PROJECT_TRUTH.md) for the current gate table and next actions.

Older phase reports are retained under [`archive/`](archive/) for historical context only. Do not use their version numbers, migration counts, or test totals as current evidence.
