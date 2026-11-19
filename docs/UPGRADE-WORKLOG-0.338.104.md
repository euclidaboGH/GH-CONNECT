# GreenHaven upgrade worklog — 0.338.104 RUN378–RUN379 and Phase 4–6 programme

**Date:** 2026-11-19  
**Baseline:** `GREENHAVEN-0_338_103-RUN376-RUN377-PHASE3-ECONOMY-CURATION-WITHDRAWAL-2026-11-19.zip`  
**Package:** `gh-connect@0.338.104`  
**Scope:** Complete the Phase 3 source route audit, continue Phase 4 product acceptance preparation, and issue separate Phase 5/6 readiness reports.

## Ordered implementation steps

1. Reopened the exact 0.338.103 source archive and used it as the working baseline.
2. Enumerated all API route files and HTTP method exports.
3. Extended mutation-owner verification to cover function and `const` handlers.
4. Classified every route without the ordinary session-auth marker and recorded its access boundary.
5. Added bounded request deadlines to the 18 previously unbounded direct-fetch route modules.
6. Standardized retryable 503 handling and removed false-success reporting on unavailable durable storage.
7. Added durable cross-instance limits to high-risk economy, curation, social, media, notification, session, WebAuthn and operator actions.
8. Added a guarded two-account Testnet Playwright acceptance suite for the eleven requested product areas.
9. Ran the targeted Phase 3, Phase 4, Phase 5, performance, security and release-source checks.
10. Issued separate Testnet and Mainnet readiness reports with operator actions and no-go decisions.
11. Added RUN380 to enforce separate environment readiness, no-go decisions and Testnet-only browser acceptance guards.

## Implementation summary

### RUN378 — complete route inventory and access classification

- Inventoried 280 API route files and 368 HTTP method exports.
- Extended route ownership checking to recognize exported `const` handlers as well as function handlers; all 186 mutating route files now map to exactly one declared domain owner.
- Reviewed all 45 routes without the ordinary session-auth source marker and added a path-by-path access classification and rationale. This includes public read/quote/health/config routes, Pi auth bootstrap, cookie session control, operator-key routes, signed scanner/webhook callbacks, middleware-blocked Field/Research routes and a retired endpoint.
- Distinguished durable mutation rate limits from local telemetry limits and intentional exceptions: 176/186 mutations are durable-rate-limited; two analytics/vitals ingestion endpoints use process-local per-IP limits; eight endpoints are disabled, worker-protected, cron-secret, middleware-blocked, HMAC/signed retry or retired exceptions.
- Added a Phase 4 authenticated Testnet Playwright acceptance suite covering all eleven product areas named by the user. It refuses Production and requires real Testnet session cookies.

### RUN379 — API reliability and abuse controls

- Added 10-second AbortSignal deadlines to the 18 route modules previously identified with unbounded direct Supabase fetches. A source scan covers 90/90 direct fetch call sites across 55 route files with abort signals.
- Sanitized connection/matching upstream failures and mapped network/timeout failures to stable no-store 503 responses.
- Removed false-success report acknowledgements when durable moderation storage is unavailable.
- Added durable per-user rate limits to feed/realtime/notifications, GHC pack purchase minute/day caps, utility spend, pioneer activity, creator tips, GHPV curation, post creation, media completion, profile writes, session/step-up/WebAuthn actions, notification/push changes, social interactions and operator financial/admin actions.
- Retained existing local prefilters where present; durable control is an additional shared cross-instance limit and fails closed on limiter unavailability for high-risk routes.

## Phase 4–6 outcomes

- Phase 4: source-level contracts cover Feed, Discover, Profiles, Messages, Communities, Marketplace, Wallet, Rewards, Membership, Notifications and Media. The authenticated two-account browser suite is prepared but not run because no real Testnet session cookies/Playwright install were available.
- Phase 5: source-level performance/security contracts passed in targeted groups. No real mobile/device screenshot sweep, browser-throttled run, heap profile, live database query-plan benchmark or load test is claimed.
- Phase 6: separate Testnet and Mainnet readiness reports created. Both are **NOT CERTIFIED / NOT APPROVED** pending supported-runtime CI, dependency remediation, live Testnet acceptance, migration/ACL rehearsal and operator evidence.

## Verification performed

- RUN378 API route/access audit: 10/10.
- RUN380 separate Testnet/Mainnet readiness gate: 12/12.
- All 379 commands in `npm run verify:static` passed across three bounded batches (130 + 130 + 119). A monolithic run exceeded the 120-second command window, so no single-process exit-0 claim is made.
- RUN379 API timeout/error/rate-limit contract: 21/21.
- RUN376 economy/curation integrity: 43/43; anti-whale runtime: 5/5.
- Domain mutation route ownership: 186/186.
- 280/280 API route files plus the Phase 4 Playwright spec pass Node TypeScript syntax parsing.
- Phase 3 RUM 17/17 and performance budget runtime 16/16.
- Phase 6 performance/accessibility 23/23; profile performance 23/23.
- Phase 10 resilience 17/17; settings/performance 14/14; navigation/media 9/9 and runtime 7/7.
- Feed controls/performance 29/29; build-memory budget 6/6; essential build hardening 20/20.
- Ecosystem registry 42 services / 10 categories / 11 Active / 30 Coming Soon / 1 Unavailable; optional-provider isolation 4 scenarios.
- Existing Phase 4 identity/community/messaging 32/32, identity integration 17/17, social/community boundaries 9/9, community completion 21/21 and pagination 12/12.
- Pi earnings withdrawal lifecycle 21/21, execution worker 21/21, settlement/recovery 15/15, receipt fencing 13/13; Pi withdrawal KYC 14/14 and boundary 12/12.
- Release hygiene, project truth and migration inventory are rerun after version synchronization.

## Not performed / release limits

- No dependency install, npm registry upgrade, full `tsc --noEmit`, ESLint or Next.js production build: this workspace runs Node 22.16.0, requires Node 24.15.0 and has no `node_modules`.
- No authenticated Playwright Testnet run, Pi Browser/device acceptance or real two-user journey.
- No Supabase query, schema/ACL/migration mutation, SQL proposal application, ledger mutation, payment, payout, Pi transfer or Mainnet action.
- The previous GitHub dependency audit remains unresolved at 22 findings (1 critical, 13 high, 6 moderate, 2 low); a new CI run is required after registry-connected dependency remediation.
- Pi Sandbox authentication remains subject to external Pi Developer Portal/Sandbox authorization verification.

Production and Mainnet remain **NOT APPROVED**. Source-level completion is not live deployment certification.
