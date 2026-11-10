# GitHub Actions Run 240 — Static verification and TypeScript repair

Date: 2026-11-10  
Baseline: GreenHaven / GH-CONNECT 0.338.18  
Scope: repair the exact Run 240 failures without changing payment, withdrawal, ledger, or migration behavior.

## Findings

1. `scripts/check-doc-hygiene.mjs` rejected the two Run 239/previous withdrawal hardening reports because the documentation allowlist did not classify these active engineering records. The reports are now explicitly listed as canonical maintenance records, and this Run 240 report is registered too.
2. `app/api/health/withdrawals/route.ts` compared `report.status` with `"blocked"`, although `WithdrawalsHealthReport.status` is the union `"ready" | "degraded" | "not_ready"`. The report already exposes the authoritative boolean `ok`; the restricted anonymous response now uses `report.ok` rather than comparing incompatible status vocabularies. Detailed operator response and HTTP status calculation remain unchanged.

## Preserved boundaries

- Withdrawal health remains read-only and does not initiate payouts.
- No ledger, payout, wallet authorization, financial policy, or database migration logic was changed.
- The anonymous response remains coarse and restricted; operator-only details remain gated.
- Existing HTTP status helper remains the source of HTTP response status.

## Validation

Run `node scripts/check-doc-hygiene.mjs`, `node scripts/check-jsx-duplicate-props.mjs`, and the full Node 24.15.0 CI gates (`npm run verify:static`, `npm run typecheck`, `npm run lint`, `npm run build`). A complete remote CI/Vercel pass is not claimed until those commands run in the supported runtime.

## Outstanding environment warnings

The repeated npm `cache-dir` warning is still emitted in the Vercel build environment even though the GitHub workflow clears the variable before its own `npm ci` steps. Remove `NPM_CONFIG_CACHE_DIR` / `npm_config_cache_dir` from Vercel Project Environment Variables if present. Deprecation and native install-script warnings require a separate lockfile-backed dependency compatibility review; this repair intentionally does not approve scripts or perform broad SDK upgrades.
