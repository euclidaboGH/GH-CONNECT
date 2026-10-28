# GreenHaven v0.150.1 — System-wide engineering audit

**Audit date:** 2026-10-27  
**Source authority:** the supplied v0.150.1 project archive  
**Status:** active engineering work; **not production approval**

## Scope reviewed

The source archive contains:

- **6** Next.js page entry points.
- **193** API route handlers.
- **133** SQL migration files.
- **166** TSX components under `components/`.
- **406** TypeScript modules under `lib/`.
- **6** Playwright spec files.
- **41** source-contract check scripts (check/verify families, excluding the orchestration runner).

This is a repository-wide static inventory and source-contract pass. It does not mean each API route, database policy, user journey, or third-party integration has been manually proven end-to-end.

## System topology inventory

### API route families

- `account`: 2 route handler(s)
- `admin`: 3 route handler(s)
- `ads`: 1 route handler(s)
- `analytics`: 1 route handler(s)
- `auth`: 13 route handler(s)
- `business`: 1 route handler(s)
- `communities`: 6 route handler(s)
- `connections`: 3 route handler(s)
- `economy`: 33 route handler(s)
- `engagement`: 1 route handler(s)
- `governance`: 2 route handler(s)
- `health`: 3 route handler(s)
- `identity`: 1 route handler(s)
- `marketplace`: 21 route handler(s)
- `matching`: 2 route handler(s)
- `media`: 6 route handler(s)
- `membership`: 3 route handler(s)
- `messaging`: 9 route handler(s)
- `notifications`: 1 route handler(s)
- `operator`: 2 route handler(s)
- `payments`: 16 route handler(s)
- `pi`: 2 route handler(s)
- `profile`: 2 route handler(s)
- `public`: 2 route handler(s)
- `realtime`: 1 route handler(s)
- `referral`: 3 route handler(s)
- `release`: 3 route handler(s)
- `reports`: 1 route handler(s)
- `security`: 1 route handler(s)
- `social`: 42 route handler(s)
- `system`: 2 route handler(s)
- `validation-key`: 1 route handler(s)
- `verification`: 2 route handler(s)
- `webhooks`: 1 route handler(s)

### Main product domains identified

Authentication and identity; feed and discovery; profiles and connections; messaging and notifications; communities and governance; media signing and uploads; marketplace and commerce; wallet and GHC economy; Pi payments; rewards and membership; legal/privacy/account lifecycle; operational readiness and diagnostics.

## Findings and improvements in this batch

### 1. Fixed a verification blind spot

The prior production verification orchestrator used a hard-coded list of historical test filenames. In the current archive, 41 listed suites were missing, and the runner classified them as `SKIP` while still producing a success-style decision. That could overstate coverage.

The runner now discovers the `check-*.mjs` and `verify-*.mjs` files actually present, excludes itself and the Node-runtime precondition, executes each discovered source check, records the exact result and fails if any discovered check fails. Missing historical filenames can no longer silently count as a successful gate.

### 2. Added an explicit production-verification command

`npm run verify:production` invokes the discovery-based runner. The JSON report records the runtime version, number of discovered checks, pass/fail counts, individual results, outstanding operator gates, and an explicit non-approval decision.

### 3. Current source-only check result

The discovery-based runner executed **40 checks: 40 passed, 0 failed** in this environment. The runtime is Node.js `v22.16.0`, while the project requires Node.js `^24.15.0`; therefore the supported-runtime install, TypeScript, lint and production build have **not** been certified here.

## Risk register — still requiring evidence

| Priority | Area | Required proof before launch |
|---|---|---|
| P0 | Supported runtime/build | `npm ci --legacy-peer-deps --no-audit`, typecheck, lint and production build under Node 24.15.0 or compatible supported 24.x. |
| P0 | Authorization and privacy | Per-route authentication/authorization review; cross-user access tests; RLS and storage policy verification; signed media expiry and ownership checks. |
| P0 | Economy and payment correctness | Idempotency, server authority, ledger reconciliation, webhook signature/replay handling, retry behavior and duplicate-request concurrency tests. |
| P0 | Database release safety | Reconcile source migrations with disposable/staging target history; replay clean install; rehearse upgrade and restore. Do not bulk-apply migrations to production. |
| P1 | User journey regression | Playwright and manual tests for welcome/auth, feed, stories, comments, profile, messaging, notifications, marketplace, ecosystem, wallet, rewards, settings and account lifecycle. |
| P1 | Performance/resilience | Representative load tests, weak-network tests, cold start, image/media behavior, cache correctness, multi-instance concurrency and recovery. |
| P1 | Accessibility/globalization | WCAG 2.2 AA audit, keyboard/screen-reader checks, text scaling, locale/date/number formatting, time zones and supported RTL behavior. |
| P1 | Operations | Alert tests, incident ownership, status communication, backup restoration, rollback rehearsal and progressive rollout. |

## Video-reference product principles retained

- Use familiar social navigation and feed hierarchy as inspiration, not as a copy of Facebook.
- Keep messaging and inbox states clear, fast and predictable, informed by WhatsApp patterns.
- Optimize for scannable content, discovery and lightweight interaction patterns inspired by X, without copying its brand or interaction model wholesale.
- Preserve GreenHaven-specific ecosystem, rewards, marketplace, membership and wallet capabilities.
- Ensure loading, empty, error, offline/retry, permission and success states are designed deliberately.
- Preserve the user's agreed brand rule: GreenHaven is canonical; the logo remains unchanged until the replacement asset is supplied.

## Safety boundaries

- No production deployment or live database migration was performed.
- No Testnet/Mainnet transaction was executed.
- No financial/reward/settlement logic was changed by this verification-runner fix.
- No feature flags were enabled.
- Passing source checks is not a substitute for live security, integration, performance, legal or operational verification.

## Next engineering sequence

1. Run the supported Node 24 dependency install, typecheck, lint and production build.
2. Perform a route-by-route security review, prioritizing identity, account lifecycle, media, messaging, wallet, rewards, payments, admin and webhooks.
3. Rehearse database migration and restore in staging.
4. Continue Phase 5 design-system consolidation and Phase 6 route/screen audit against the supplied walkthrough videos.
5. Run critical journey E2E, responsive/accessibility checks and load/recovery tests.
6. Use explicit phase acceptance gates and a signed go/no-go decision before any global launch.
