# RUN331 — Phase 1–6 gap register and Phase 7 Communities kickoff

**Working baseline:** `GREENHAVEN-0.338.99-RUN330-PHASE5-GATES-PHASE6-PROFILE-PERFORMANCE.zip`  
**Package:** `gh-connect@0.338.99` (source-only; package version unchanged).  
**Disposition:** local engineering candidate; no push, deployment, migration application, payment, account mutation or database write.

## 1. Phase 1–6 completion truth

The current source tree contains multiple historical phase-numbering schemes. This run follows the active RUN321–RUN330 recovery sequence and its Phase 5 five-run programme, rather than treating older phase labels as a single interchangeable roadmap.

| Workstream | Source implementation | Remaining exit evidence | Status |
|---|---|---|---|
| Phase 1 — public/auth boundary and Pi sign-in | Public `/r/:slug` and exact `/field` route boundary, on-demand Pi SDK loading, token-free auth telemetry and route-policy regression tests. | Real Pi Browser Testnet login, new/returning Pioneer onboarding, post-deploy `/api/auth/pi` tracing, and Node 24.15.x dependency-backed build. | **Implemented; awaiting external verification.** |
| Phase 2 — Field Research and integrity | Public response hardening, timed exam lifecycle source, owner-scoped election administration, membership lifecycle, authenticated tally API proposal, scoped evidence upload and custody contracts. | Disposable PostgreSQL 17 rehearsal, exact target migration history/catalog reconciliation, approved geography provenance, tally UI/reconciliation, scanner provider/worker, and live RLS/device tests. Three research/evidence migrations remain held. | **Partially implemented; blocked on dependencies and acceptance.** |
| Phase 3 — Feed, Community, Messaging and Marketplace quality | Canonical feed and engagement foundations, durable media, moderation, pagination, community controls, seller/SKU/order/fulfilment foundations with focused source/runtime checks. | Multi-account/device/Pi Browser acceptance, low-bandwidth tests, Testnet checkout, Pi receipt replay/timeout tests and seller net-proceeds reconciliation. | **Source gates pass; live acceptance open.** |
| Phase 4 — identity, community discussion and Messenger controls | Selected identity/authentication, community participation and Messenger community communication tracks; session/step-up, member directory, invitations, group creation and consent-based profile sharing. | Supported-runtime tests, disposable DB rehearsal, migration/history reconciliation and two-account Testnet/device acceptance. | **Source closeout; release verification open.** |
| Phase 5 — RUN327–RUN331 50-upgrade programme | Source foundations and contracts are present for migration review, tally API, evidence custody, Feed/Community/Messaging and Marketplace. | RUN327 PostgreSQL rehearsal; RUN328 field-agent tally-entry UI and independent multi-agent reconciliation; RUN329 authoritative geography and trusted scanner; RUN330/331 multi-device and Testnet checkout acceptance. | **NOT CLOSED.** |
| Phase 6 — Profile and Identity performance | Relationship cache identity bounds, 50,000-item set cap, 500 default/5,000 hard batch cap, per-domain cache isolation and block-first policy. | Remaining objective audit, representative dataset performance measurements, supported Node 24 build, browser/device accessibility and account-switch acceptance. | **Source hardening increment delivered; full phase acceptance open.** |

A passing static or pure-logic check is not evidence that a remote migration is applied, a provider is configured, a payment settled, a device flow works, or a result is certified.

## 2. RUN331 implementation — Phase 7 Communities account isolation

The Communities screen previously persisted non-authoritative joined-ID hints and demo board snapshots under device-wide local/session storage keys. Although the server remained the membership authority, those local hints could survive an account switch and influence the next account's UI.

This increment:

- Namespaces community membership and board cache keys by the active GreenHaven identity (`v2` key namespace).
- Uses an explicit allowlist of cache namespaces and rejects invalid/oversized identity keys.
- Stops reading legacy device-wide cache keys; old shared hints are intentionally not migrated because their account ownership cannot be proven.
- Bounds and deduplicates membership hints (maximum 5,000 IDs; each ID at most 256 characters).
- Bounds board cache parsing (maximum 500 communities, 100 posts per community, 2 MB serialized input) and discards malformed entries.
- Subscribes to `IdentityService`; on account change it fences previous-account writes, loads only the new account's cache, clears selected-community/platform snapshots and reloads the directory.
- Keys community filter preferences to the subscribed identity and fences in-flight directory requests on identity change.
- Keeps all local cache data explicitly non-authoritative; membership, roles, moderation, posts and access continue to depend on server/domain authorization.

## 3. Verification

- Phase 7 community cache runtime tests: **13/13**.
- Phase 7 community cache source contract: **12/12**.
- Phase 1 truth/honesty: **13/13**.
- Phase 2 commerce/cart: **14/14**.
- Phase 3 wallet/rewards separation: **13/13**.
- Phase 4 Discover/Communities: **14/14**.
- Phase 5 shell release gate: **14/14**.
- Phase 5b video gap-fill: **14/14**.
- Phase 6 messaging inbox: **8/8**.
- Existing Phase 7 premium profile, identity showcase, governance and Pi identity/payout source gates also pass in the current workspace.

The new source/runtime tests are registered in both `verify:static` and `prebuild:checks`. Full project verification must still be rerun on Node 24.15.x with lockfile-installed dependencies.

## 4. Non-negotiable release boundaries

- No SQL migration was applied; the three held research/evidence migrations remain held.
- No geography dataset was invented or imported; no scanner was marked clean without a trusted provider.
- No election result was certified; tally reconciliation remains pending.
- No Pi/GHC balance, reward, payment, payout, seller settlement, entitlement or user account was mutated.
- No GitHub push, Vercel deployment or Mainnet operation occurred.
- Production remains **NOT APPROVED** pending PostgreSQL rehearsal, exact environment reconciliation, Node 24.15.x typecheck/lint/build, browser/device acceptance and operator evidence.
