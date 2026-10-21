# Phase 9–10 rework — Operations resilience and release evidence

**Project:** GH-CONNECT / GreenHaven 0.63.25  
**Decision:** Source hardening delivered; Testnet beta remains **NOT APPROVED**.  
**Remote activity:** None. No Supabase, Vercel, Pi, Paystack, database, or production endpoint was contacted or changed.

## Why these phases were revisited

The earlier phases already documented release requirements and checked their presence in source. That alone did not provide a repeatable, integrity-checked way to collect and review actual release evidence. This rework closes that tooling gap without pretending to complete live verification.

## Major additions

- Added `scripts/lib/release-evidence.mjs`, a dependency-free evidence manifest validator.
- Added `scripts/validate-release-evidence.mjs` with template creation and validation commands.
- Added `docs/evidence/testnet-beta-evidence.template.json` and an operator guide.
- Added `scripts/test-release-evidence-validator.mjs` and wired it into `ci:verify`.
- Expanded Phase 9 and Phase 10 policy regression suites to check the evidence workflow.
- Preserved the release policy's blocked default, disabled financial features, Testnet-only evidence target, and separate Mainnet approval process.

## Controls enforced by the validator

- Requires the full commit SHA, package version, ISO timestamps, actual npm version and Node `24.15.0`.
- Requires all 11 defined Testnet gates to be explicitly passed.
- Requires one or more real evidence artifacts per gate, relative paths, SHA-256 checksums and named reviewers.
- Verifies artifact existence, file type and checksum; rejects directory traversal and symlink escapes.
- Scans both manifest fields and evidence text for common credential/token patterns.
- Requires evidence timestamps to precede packet generation and approval to follow packet generation.
- Requires each evidence reviewer to be one of four named, distinct accountable approvers: engineering, security, operations, and finance/product.
- Rejects unresolved risks, missing reviewers, unknown gate IDs, incomplete packets and any release target other than `testnet-preview`.
- Refuses to overwrite an existing evidence packet when generating a template.

The validator is a consistency and hygiene control. It cannot prove that an artifact is truthful, that a remote environment is configured correctly, or that a human reviewer exercised the described flow. Independent inspection remains mandatory.

## Commands

```sh
npm run test:phase9-operations-resilience
npm run test:phase10-testnet-beta-gates
npm run test:release-evidence-validator
npm run release:evidence:template
npm run release:evidence:validate
```

Template generation and evidence validation are offline. The validation command is expected to fail on the committed blocked template until a separate working packet has complete evidence.

## Verification performed in this work session

- Phase 9 operations/resilience assertions: **19/19 passed**.
- Phase 10 beta gate assertions: **18/18 passed**.
- Release evidence validator unit and CLI tests: **22/22 passed**.
- Project integrity audit: **36 passed, 0 errors, 0 warnings**.
- Dependency-lock consistency: **passed**.
- JSX safety: **710 files scanned, passed**.
- Phase 5–8 regression suites: **11/11, 16/16, 26/26, and 23/23 passed**, respectively.

## Still blocked

- Clean dependency install, typecheck, lint, and production build on Node `24.15.0`. The available runtime is Node `22.16.0`, and `scripts/check-node-runtime.mjs` correctly rejects it (exit 1); no dependency install/typecheck/lint/build is claimed.
- Live Preview/Testnet environment attestation and migration reconciliation.
- Two-account Pi Testnet authentication and authorization tests.
- Payment-provider sandbox reconciliation and concurrency/replay checks.
- Real backup restore, rollback, alert-routing and kill-switch rehearsals.
- Named, independent operator approval after the above evidence is collected.

**No beta or Mainnet approval is granted by this source rework.**
