> HISTORICAL RECORD — not current release status. Check `docs/PROJECT_TRUTH.md` and current CI evidence before relying on this report.

---

# Phase 1 — Remaining Build and Dependency Gates

Run from a clean checkout of the authoritative v0.63.25 baseline on Node.js 24.15.0.

## Local preflight

```bash
node --version
npm --version
npm run check:runtime
npm run test:runtime-contract
npm run audit:project-integrity
npm run check:dependency-lock-integrity
```

## Clean install and static gates

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run build
```

## Complete source regression suite

```bash
set -euo pipefail
for test_file in scripts/test-*.mjs; do
  echo "==> $test_file"
  node "$test_file"
done
```

## Acceptance criteria

- Use the exact supported Node runtime pinned in `.nvmrc`.
- Do not remove or regenerate `package-lock.json` to work around installation failures.
- Do not use `typescript.ignoreBuildErrors`, disable ESLint during builds, or suppress failures as a release fix.
- Record full command logs and the commit SHA.
- A pull-request E2E skip is not release evidence; Testnet branch release E2E requires its configured base URL and test credentials.
- No live migrations, payouts, Pi Mainnet calls, or production changes are part of Phase 1.
