# GitHub push / static workflow failure repair — 2026-10-21

## Fixed

1. `lib/server/revenue/revenue-event.ts`: corrected the malformed trailing-slash regular expression in the revenue RPC endpoint construction. The valid expression is `replace(/\/$/, "")`.
2. GitHub Actions: pinned hosted runners to `ubuntu-24.04` instead of the moving `ubuntu-latest` label to avoid the announced Ubuntu 26 migration changing the build environment unexpectedly.
3. GitHub Actions runtimes: upgraded checkout to `actions/checkout@v6`, setup-node to `actions/setup-node@v7`, artifact upload to `actions/upload-artifact@v7`, and the lock-repair PR action to `peter-evans/create-pull-request@v8`. These versions use the Node.js 24 action runtime.
4. Added `scripts/test-github-push-fixes.mjs`, which guards the repaired regex, endpoint, pinned OS and action versions.

## Verification performed in this workspace

- GitHub push fix regression: passed.
- Company revenue source invariants: passed.
- Project integrity audit: 36 checks passed, 0 errors, 0 warnings.
- Release hygiene: 11/11 passed.
- Phase 1–2 foundation: 18/18 passed.
- Phase 1 release readiness: 13/13 passed.
- Both changed workflow files parse as YAML.

## Still required in GitHub

Push this archive's changed files to the intended branch and rerun Actions. This local validation does not claim that the remote GitHub workflow, dependency install, TypeScript build or full CI has run. No database migration or deployment was performed.
