# GreenHaven v0.153.0 — Phase 1–12 systematic hardening worklog

## Concrete implementation changes

1. **Phase 1 — API request correlation:** API middleware now creates or validates a canonical UUID request ID, forwards it to route handlers as `x-request-id`, and returns it as `X-Request-ID`. Cross-origin mutation failures include the same ID for support/debug correlation. Untrusted arbitrary request-ID strings are not reflected.
2. **Phase 2 — Canonical account-switch identity:** Reordered identity resolution so the currently verified Pi UID takes precedence over a cached explicit user ID. This prevents a stale identity from winning when a different Pi account signs in. Added a regression contract.
3. **Phase 2 / Phase 8 — Financial amount boundaries:** Six authoritative GHC transfer/request/pack-purchase/pending/spend/durable-spend entry points no longer call `Math.abs` on supplied amounts. Negative values are rejected by their existing positive-amount validation instead of being silently converted into positive financial operations.
4. **Phase 3 — Profile hydration resource bounds:** Canonical profile hydration now caps upstream response consumption at 1 MiB, uses streaming reads, rejects malformed/oversized JSON, rejects unexpectedly large row sets, and only accepts profile rows whose IDs were requested. The five-second upstream timeout and public-column projection remain in place.
5. **Phase 6 — Navigation avatar URL safety:** Navigation now rejects protocol-relative, backslash/control-character, and non-HTTPS absolute avatar URLs before dispatching chat events.
6. **Phase 9 — Pi history validation:** Explicitly blank supplied amounts are rejected; Pi history projection enforces the supported amount ceiling and eight-decimal precision instead of displaying malformed amounts.
7. **Phase 1 — Explicit Pi network configuration schema:** Readiness now warns or blocks when `NEXT_PUBLIC_PI_SANDBOX` is present but is not exactly `true` or `false`, preventing a typo from silently falling through to environment-derived network selection.
8. **Phase 12 — Release checks:** Added a dedicated cross-phase hardening audit and registered it in the static verification suite. Version metadata is synchronized to `0.153.0`.

## Verification performed

- `scripts/check-phase1-12-consolidation.mjs`
- `scripts/check-phase1-12-hardening-upgrade.mjs`
- `scripts/check-phase2-canonical-identity.mjs`
- `scripts/check-security-headers.mjs`
- `scripts/check-api-csrf-contract.mjs`
- `scripts/check-phase2-wallet-transfer-integrity.mjs`
- `scripts/check-phase3-profile-identity.mjs`
- `scripts/check-phase6-shell-navigation.mjs`
- `scripts/check-phase9-wallet-transaction-integration.mjs`
- `scripts/verify-phase14-static.mjs`

Results at this release: the focused hardening audit passed 18/18; canonical identity passed 10/10; profile hydration passed 14/14; navigation passed 17/17; Pi transaction integration passed 35/35; the full static suite passed 41/41; release hygiene passed 11/11; project truth passed 10/10. These are source-level checks only. The available runtime in this workspace is Node.js 22.16.0, while this project requires Node.js `^24.15.0`; `node_modules` is not present. TypeScript, lint, production build, browser/accessibility journeys, live Supabase/PostgreSQL restore, and Pi Testnet are not claimed as passed.

## Production-safety boundaries

- No production database, migration, wallet, payment, payout, or Pi Mainnet state was modified.
- A negative amount is rejected at the in-process authoritative financial entry points, but production acceptance still requires testing every durable RPC and API boundary against a disposable database.
- The request ID is a correlation token, not an authentication credential. It must not be used as an authorization input.
- The complete 120-item Phase 1–12 program remains a checklist of independent acceptance units; this release records the concrete changes above and does not mislabel all 120 as completed.
