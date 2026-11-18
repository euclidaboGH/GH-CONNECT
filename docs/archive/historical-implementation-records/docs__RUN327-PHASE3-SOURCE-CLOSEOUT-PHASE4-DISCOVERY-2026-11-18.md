# RUN327 — Phase 3 source closeout and Phase 4 scope discovery

**Working source:** `GREENHAVEN-0.338.99-RUN326-PHASE2-ATOMIC-TALLY-PHASE3-MESSAGING.zip`
**Package identity:** `gh-connect@0.338.99` (source-only increment; package version intentionally unchanged)
**Disposition:** local candidate only; not pushed or deployed.

## Phase 3 — Feed, Community, Messaging and Marketplace

### Source disposition

The Phase 3 source workstreams in RUN326 have passed their focused source/runtime regression gates in this workspace. This is a **source-level closeout**, not operational or production verification.

| Workstream | Evidence in this run | Result |
|---|---|---:|
| Messaging | Payload-bound idempotency, duplicate-key race recovery, HTTP 409 conflict mapping, terminal client retry handling, no duplicate notification fan-out | 10/10 |
| Feed | Unicode-aware topic parsing, explainable ranking, chronological Following/Latest, visibility/mute fail-closed behavior, monotonic cursors, account fencing | 25/25; runtime tests PASS |
| Feed preferences | Account-keyed durable preferences, RLS/browser-role denial, service-role RPCs, authenticated/rate-limited API, honest device-only fallback | 13/13; runtime tests PASS |
| Community | Accessible bounded poll values and controls | 10/10 |
| Community posts | Safe engagement aggregates | 6/6 |
| Community governance and pagination | Canonical read-only historical renderer, pinned/Top/Hot ordering, server-first moderation, cursor fencing | 21/21 + 12/12 |
| Marketplace search | Canonical Unicode normalization and server filtering | 6/6 |
| Marketplace saved addresses | Authenticated API, bounds/rate limits, server-only storage contract, RLS-deny design, no client fallback, no commerce/payment side effects | 29/29; helper tests PASS |
| Creator/media foundations retained | Durable media policy, upload cancellation/identity fencing, draft recovery and retry behavior | 13/13, 12/12, 11/11, 7/7; runtime tests PASS |
| Upload recovery | Retry and queued-state recovery behavior | 9/9 |

The full repository `npm run verify:static` command also completed successfully on the extracted RUN326 source tree. The focused checks above were rerun individually and passed.

### Explicit Phase 3 limits

- Marketplace saved-address SQL remains a held proposal; the required database migration has not been applied. The API must continue to fail closed when the server table/RPC is unavailable.
- Feed preferences and other held migrations require migration-history reconciliation, dependency review and disposable PostgreSQL rehearsal before any target application.
- Messaging, Feed, Community and Marketplace still require authenticated multi-account/browser/device acceptance against the actual Testnet services.
- A passing source contract does not prove the live Supabase schema, RPCs, RLS, storage, notifications or realtime behavior.
- The workspace runtime is Node `22.16.0`; this repository requires Node `^24.15.0`. A dependency-backed Node 24 install, full typecheck, lint, prebuild and Next.js production build are not claimed here.
- No migration, Testnet/Mainnet database change, payment, payout, reward, account change, push, deployment or production release occurred.

**Phase 3 status:** Source implementation and focused source/runtime gates closed for this RUN326 scope. **Verified/operational completion remains BLOCKED** on the external acceptance items above. Production remains NOT APPROVED.

## Phase 4 — discovery started; implementation scope requires one authoritative track

The current archive contains multiple unrelated definitions labelled “Phase 4”. They cannot safely be merged into one phase without changing scope:

1. **Identity & Authentication:** session/account/authorization integrity, including the historical Phase 3 → Phase 4 operator gate in `docs/PHASE-3-OPERATOR-LIVE-ACCEPTANCE-0.330.50.md` and the implementation baseline in `docs/PHASE-4-IDENTITY-AUTHENTICATION-2026-11-08.md`. That transition's Phase 3 is the older wallet/rewards/membership programme, not the RUN326 Feed/Community/Messaging/Marketplace scope.
2. **Social experience Phase 4:** Community posts and discussion consistency in `docs/GREENHAVEN-SOCIAL-EXPERIENCE-TRANSFORMATION-ROADMAP-2026-11-14.md`. Its source implementation is already described as complete in Run #306, with external acceptance still pending.
3. **Messenger Phase 4:** Community communications and governance (workstreams 29–35) in `docs/PRIORITY_10_FOUR_PHASE_EXECUTION_PLAN.md`, a separate four-phase communications roadmap.
4. **Historical financial/cart/profile phases:** additional Phase 4 labels exist in older implementation reports and are not the next step of RUN326 by default.

This run therefore starts Phase 4 discovery by identifying the competing scope definitions and preserving their boundaries. No Phase 4 implementation was guessed or silently substituted. Select the intended Phase 4 track before source changes are made.

## Safety and release boundary

GreenHaven and Pi Network identity/authentication remain unchanged. Financial and entitlement authority remains server-side and canonical. No fabricated balance/reward/transaction, client-side finance authority, backend/auth/RLS bypass, mock backend, or unrequested business-logic change was introduced. Mainnet remains untouched; all held migrations remain unapplied; Coming Soon services remain unavailable. No GitHub push or Vercel deployment was performed.
