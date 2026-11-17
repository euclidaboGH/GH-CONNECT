# GreenHaven Run #245 delivery

- Project baseline: 0.338.20 (in-place maintenance; no version bump).
- Main CI repair: stale lint-remediation contract now checks the actual Pi withdrawal sheet callback architecture.
- Account hydration repair: domain factory calls now share a single account-anchor POST per user per tab, with bounded memoization, negative caching and timeout; durable fail-closed rate limiting is retained.
- Fifteen focused safe improvements are documented in `docs/VERCEL-GITHUB-RUN-245-LINT-AND-ACCOUNT-HYDRATION-2026-11-10.md`.
- Focused checks: lint-remediation contract 9/9; account hydration hardening 16/16; project truth 11/11; withdrawal single-entrypoint 6/6; Pi withdrawal consent/identity 12/12; migration source manifest 199/199; documentation hygiene PASS.
- Full dependency-backed ESLint/typecheck/build not run in this container: Node 22.16.0, no `node_modules`; supported CI runtime is Node 24.15.0.
- No migrations, payments, balances, transfers, production settings, deployments, GitHub pushes or branch changes performed. Production remains NOT APPROVED.
