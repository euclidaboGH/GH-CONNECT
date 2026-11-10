# Run #245 — lint contract and account hydration hardening

Date: 2026-11-10  
Source baseline: GreenHaven `0.338.20`, Run #244 release-truth archive.

## Confirmed findings

1. GitHub Actions Run #245 failed before ESLint itself ran. `prelint` stopped at `scripts/check-github-195-lint-remediation.mjs` because the checker still required `onRequestPayout`, a retired dashboard callback. The current withdrawal architecture intentionally routes all payout requests through the dedicated consent/PIN sheet.
2. The Vercel `POST /api/economy/account` 429 is consistent with the route's explicit durable per-user mutation limit (12 requests per 60 seconds, fail-closed). The membership domain was invoking the idempotent account-anchor POST whenever domain services were constructed, without in-flight or session memoization. Repeated factory construction could therefore consume the quota. The correct fix is to deduplicate the intended POST, not to remove the security limit or change the endpoint to GET (the server operation ensures/persists the canonical account anchor).
3. The supplied Vercel requests for `/api/messaging/conversations`, `/api/payments/reconciliation`, `/api/payments/intents`, and `/api/economy/account` include successful 200 responses. One account POST returned 429; this is a rate-limit response, not evidence of a database outage. These request samples do not prove payment settlement or Pi transfer completion.

## Fifteen focused safe improvements

1. Replaced the stale `onRequestPayout` expectation with assertions for the actual dedicated-sheet withdrawal architecture.
2. Asserted that `openWithdrawSheet` remains a stable zero-dependency callback.
3. Asserted that the fee-preview callback retains its `snap` dependency.
4. Asserted that the withdraw-focus callback depends on the stable sheet opener.
5. Stabilized the retained wallet-authorization revoke callback with explicit `authorizingWallet` and `refresh` dependencies.
6. Added per-user in-flight deduplication for account-anchor hydration.
7. Added per-tab memoization for successfully server-confirmed account anchors.
8. Bounded the in-memory account-anchor cache to 128 users.
9. Added a 30-second negative cache after unavailable/limited hydration to prevent immediate retry storms.
10. Added an eight-second request timeout.
11. Explicitly include same-origin credentials for the authenticated account request.
12. Explicitly request JSON and send the expected JSON content type.
13. Keep the request `no-store` to avoid stale account-anchor responses.
14. Keep the idempotent POST contract and send only an empty hint object; no profile-controlled timestamp is submitted by this hydration path.
15. Validate the returned anchor as a finite positive timestamp, persist only a server-confirmed value, and retain the last confirmed local value as an offline fallback.

## Verification

- `scripts/check-github-195-lint-remediation.mjs`: 9/9.
- `scripts/check-run245-account-hydration.mjs`: 16/16.
- `scripts/check-project-truth.mjs`: 11/11; migration inventory remains synchronized at 199 SQL files.
- `scripts/check-phase-withdrawal-single-entrypoint.mjs`: 6/6.
- `scripts/check-pi-withdraw-consent-identity-0.338.16.mjs`: 12/12.
- The account POST's durable 12-per-minute fail-closed rate limit and `Retry-After` response are preserved.

## Verification limits and safety

The available environment is Node.js 22.16.0 and has no `node_modules`; the project requires Node.js 24.15.0. The GitHub Run #245 excerpt fails in a prelint source-contract script before ESLint executes. This repair makes that contract match the current code and adds regression coverage, but does not claim a complete dependency-backed `npm run lint`, TypeScript check or Next.js build. Those must run in the repository's pinned Node.js 24.15.0 CI environment.

No migration was applied. No database, balance, GHC ledger, Pi authorization, payout or payment settlement was mutated. No production deployment, Vercel setting change, GitHub push or branch change was performed. Production remains **NOT APPROVED**.
