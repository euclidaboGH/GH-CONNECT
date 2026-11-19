# Phase 4 — Product acceptance plan and source verification

## Product surfaces in scope

The acceptance suite covers the eleven surfaces named in the request: Feed, Discover, Profiles, Messages, Communities, Marketplace, Wallet, Rewards, Membership, Notifications and Media.

A new `e2e/phase4-product-acceptance.spec.ts` performs authenticated Testnet API acceptance across those surfaces, checks that failures are explicit degraded responses rather than HTTP 500s, checks that API bodies do not expose server credentials, tests anonymous access boundaries, and supports two real accounts in isolated browser contexts to verify identity separation. It refuses Production targets and requires explicit Testnet flags and real session cookies. Run with:

```bash
GHC_E2E_BASE_URL='<Preview Testnet URL>' \
PI_NETWORK=testnet \
NEXT_PUBLIC_PI_SANDBOX=true \
GHC_E2E_PHASE4=1 \
GHC_E2E_ALLOW_TESTNET=1 \
GHC_E2E_COOKIE_A='<real Testnet gh_session cookie>' \
GHC_E2E_COOKIE_B='<second real Testnet gh_session cookie>' \
npm run test:e2e:phase4
```

Do not paste cookies into chat, CI logs or source files. The second-account isolation test is skipped unless both real sessions are supplied.

## Source-level verification already available

- Feed: canonical feed/identity/privacy checks, keyset pagination, feed quality/preferences and performance budget contracts.
- Discover/Profile: discovery ranking and profile identity snapshot/performance/privacy checks.
- Messages/Communities: canonical identity, durable session, direct/group messaging, invitation, membership and community pagination/boundary contracts.
- Marketplace: cart, search, seller, variants, fulfilment, atomic transition, payout recovery and receipt fencing contracts.
- Wallet/Rewards: unified earnings ledger, atomic ledger guards, withdrawal request/worker/settlement recovery, rewards issuance boundaries and wallet/rewards membership closeout checks.
- Membership: purchase policy, renewal, session safety, row parsing, idempotency and cross-domain settlement checks.
- Notifications: account isolation, action handling, preferences, delivery architecture and push-secret boundary contracts.
- Media: creator upload recovery, cancellation identity, durable media URLs, upload session ownership, media API hardening and navigation/media contracts.

These source/runtime contract tests are not a substitute for the authenticated browser suite. No real account cookies were available in this run, Playwright dependencies were not installed in this workspace, and no Testnet browser/device journey was executed. Phase 4 is therefore **source-prepared, live acceptance pending**.

## Additional execution status — 2026-11-19

The source suite is now paired with an explicit Phase 5 browser suite, but the Phase 4 live acceptance result remains **PENDING**, not passed. No real Testnet session cookies, Pi Browser/device session, or two-account fixture were supplied in this workspace. The latest Vercel Testnet-branch Preview was observed as `READY`, but it was built from commit `787ab56ef4f2b6ad4d054c4357c0fab43c684bc7`, not the 0.338.105 source candidate or its 0.338.106 configuration-only derivative. Therefore its READY state does not certify the current candidate or any of the eleven product journeys.

Required final execution: use two genuine Testnet users and run the documented command against the exact deployment built from the reviewed candidate commit. Retain redacted Playwright reports and verify each surface's actual data and user action—not just its API status.
