# GH-CONNECT Product Surface Audit — 2026-10-11

## Scope
Static review of the checked-out source tree, App Router endpoints, UI surface inventory, existing verification scripts, README implementation notes, and local typecheck. This is not a live Supabase, Pi Browser, Vercel, or multi-user test.

## Surface inventory and integration contracts

| Surface | Primary source areas | Required contract to release |
|---|---|---|
| Onboarding / identity | `components/ghc/onboarding.tsx`, `app/api/auth/*`, `app/api/profile/me/route.ts` | Returning identities resolve to the existing account; profile completion comes from persisted profile state; retries are idempotent; no client-only completion flag. |
| Home / feed / timeline | `enhanced-feed-screen.tsx`, `enhanced-post-card.tsx`, `social/feed`, `social/posts` | Feed cards use canonical post IDs and server-owned counts/reward summaries; pagination, empty/error/offline states; timeline and feed actions share the same mutation contracts. |
| Discovery / search | `discovery-grid-screen.tsx`, `global-search.tsx`, `social/search`, `communities` | Search routes return typed results with authorization and pagination; no demo content in production; every result opens a real destination. |
| Matches / connections | `matches-screen.tsx`, `match-screen.tsx`, `connections/*` | Request, accept, decline, block and cancel transitions remain server-authoritative and reflected in all surfaces. |
| Communities | `communities-screen.tsx`, `premium-community-hub.tsx`, `communities/*` | Membership, roles, requests, moderation and community feed use one membership authority; unauthorized private content is never returned. |
| Messages | `messages-screen.tsx`, `message-screen.tsx`, `messaging/*` | Conversation membership is checked on every read/write; unread/read state and delivery failures are durable; avoid enabling messaging until IDOR suites and live tests pass. |
| Profile / settings | `profile-screen.tsx`, `profile-components.tsx`, `profile/me`, `auth/sessions/*` | Profile fields persist and hydrate consistently; settings and session revocation are server-confirmed; onboarding does not erase or duplicate existing profiles. |
| Wallet / rewards | `premium-wallet-screen.tsx`, `daily-reward-experience.tsx`, `economy/*`, `social/posts/[id]/reward` | Ledger and balances are server-authoritative, idempotent, auditable; UI displays confirmed ledger-derived amounts only; votes never mint funds. |
| Membership / ecosystem | `premium-membership-screen.tsx`, `greenhaven-ecosystem-screen.tsx`, `membership/*` | Entitlements derive from durable membership state; expiry/recovery are handled; unavailable ecosystem integrations are labelled honestly. |
| Marketplace | `marketplace-screen.tsx`, `marketplace/*`, `payments/*` | Listing ownership, order state transitions, payment confirmation and fulfilment are server-verified; never trust a client success state. |
| Pi payments / identity | `payments/*`, `auth/pi`, `validation-key`, `ads/verify` | Use official supported Pi APIs only; payment approval/completion/fulfilment is idempotent and recoverable; no reward from unverified ad callbacks. |
| Trust / governance | `governance/*`, `reports`, `social/blocks`, `social/mutes`, `social/restricts` | Report/moderation actions are permission-gated, auditable and reflected in feed/search/message surfaces. |

## Concrete gaps confirmed in repository notes/source

1. **Post restoration after soft-delete is not implemented** (README implementation status). Add a restore RPC and UI only after ownership, retention, audit, and reward reversal semantics are defined.
2. **CQI feed ranking, vote-to-GHC, and creator quality payouts are deferred** (README). Do not expose these as live economic promises until ranking inputs, Sybil resistance, anti-collusion, caps, settlement and ledger tests exist.
3. **Migrations `20261013`–`20261020` are repository-only until Testnet** (README). Reconcile each migration against local and remote `schema_migrations`; do not blindly push or mark applied. Confirm functions, grants, RLS and rollback strategy before release.
4. **Server-side Pi ad verification is explicitly not implemented** (`app/api/ads/verify/route.ts`). Endpoint must fail closed and must not issue rewards.
5. **Pi staking endpoint is a safe stub until official API details are confirmed** (`app/api/pi/staking/route.ts`). Keep disabled and clearly labelled; do not infer staking balances or transaction success.
6. **Local typecheck is currently blocked by broken/incomplete installed type definitions**, including `@types/node`, React, `qrcode`, `d3-*`, `estree`, `json-schema`, `json5`, and `trusted-types`. This is an environment/dependency installation blocker, not proof that source compiles.
7. **Static test success is not equivalent to runtime correctness.** The repository's 30 automated release suites pass, but install/typecheck/lint/build, remote migration reconciliation, Pi Browser E2E, and multi-instance concurrency are explicit operator gates.

## Verification performed

- `node scripts/verify-production-release.mjs`: 30 automated suites passed; script reports operator gates still required.
- `npm run typecheck`: failed before checking project source due to missing type-definition packages in current `node_modules`.
- Source inspection: 110 API route files found under `app/api`; product surface inventory above maps the main client components and server routes.

## Required release gates (in order)

1. Clean environment: Node 20.18+ through 24.x; run `npm ci --legacy-peer-deps` from the exact lockfile and record the resolved Node/npm versions.
2. `npm run typecheck`, `npm run lint`, `npm run test:safety`, `npm run verify:static`, `npm run test:release`, then `npm run build`. Fix all failures; do not bypass typecheck or turn off build lint gates to obtain a green deployment.
3. Validate `.env.example` against every server env reference. Confirm secrets are server-only, production readiness fails closed, and logs redact tokens/payment identifiers.
4. Reconcile migration filenames and each local/remote version. Review SQL diffs, RLS, function grants, idempotency keys, unique constraints, ledger immutability and rollback/forward-repair steps. Apply to Testnet first.
5. E2E test new user onboarding, returning user login, incomplete profile completion, logout/login, session revoke, feed pagination, create/edit/archive/report post, connection request lifecycle, community role boundaries, conversation IDOR, wallet transfers/withdrawals, reward settlement, membership expiry, marketplace order payment and recovery.
6. Pi Browser E2E on Testnet: login identity continuity, payment create/approve/complete/fulfil/recover, duplicate callbacks, failed/cancelled payments, domain validation and network mismatch.
7. Concurrency test with multiple workers for daily claims, ledger transfers, reward settlement and payment fulfilment. Confirm exactly-once ledger effects under retries.
8. Verify production health endpoints, monitoring/alerts, backups and restore procedure, rate limits, abuse controls, privacy/export/delete flows, incident rollback and operator runbooks.

## Safety rule

Do not automatically mark every returning identity as onboarded. Resolve the stable identity to the correct existing user, fetch that user's persisted profile, and only repair the onboarding flag when required profile fields satisfy the current completion policy. Do not match accounts solely by display name, photo, or unverified email. Preserve incomplete profiles and avoid duplicate account creation.
