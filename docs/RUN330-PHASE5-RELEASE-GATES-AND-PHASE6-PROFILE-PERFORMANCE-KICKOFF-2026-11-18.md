# RUN330 — Phase 5 release-gate reconciliation and Phase 6 kickoff

**Working baseline:** RUN329 Phase 4 closeout / Phase 5 programme archive.  
**Package:** `gh-connect@0.338.99` (source-only; no package-version change).  
**Disposition:** local engineering candidate; no push, deployment, migration application or database mutation.

## 1. Phase 5 — implementation evidence versus release acceptance

The five-run programme remains a 50-item acceptance register, not a blanket declaration that all items are shipped. This run reviewed the current source and regression gates and records the exact remaining blockers.

| Run | Source evidence in this candidate | Release disposition |
|---|---|---|
| RUN327 — migration review/rehearsal | Migration inventory, manifest, lexical integrity, RLS/function ACL checks and held-migration readiness contracts exist. | **BLOCKED:** no disposable PostgreSQL 17 instance/`psql`/Docker is available here. A source scan is not a clean-database rehearsal or failure-injection test. Exact target schema/history reconciliation remains required. |
| RUN328 — tally UI/agent/reconciliation | Authenticated atomic tally POST route and held SQL proposal exist; owner-side contest/candidate/assignment management exists. | **INCOMPLETE:** the field-agent tally entry UI and independent multi-agent reconciliation workflow are not activated. The SQL proposal is held and un-applied. No tally is certified. |
| RUN329 — geography/scanner | Geography schema supports source reference/version; scoped evidence upload, SHA-256 custody and signed scanner callback contracts exist. | **BLOCKED:** no authoritative licensed geographic dataset with source provenance has been supplied/approved; no trusted malware-scanner provider credentials/worker are configured. Unknown, timeout and failed scans remain quarantined. |
| RUN330 — Feed/Community/Messaging | Canonical feed, preferences, engagement, community moderation/pagination and durable messaging/group controls are present with focused source/runtime checks. | **SOURCE CHECKS PASS;** multi-account, multi-device, low-bandwidth and Pi Browser acceptance still required. |
| RUN331 — Marketplace/checkout | Seller centre, SKU variants, atomic inventory reservations, order lifecycle, fulfilment timeline, payment and settlement boundaries have focused source checks. | **SOURCE CHECKS PASS;** end-to-end Testnet checkout, provider receipt/replay/timeout cases and seller proceeds reconciliation still required. Mainnet remains disabled. |

The current source tests include RUN328 tally contract 20/20, scoped evidence engine 25/25, evidence signature tests 16/16, Feed quality 25/25, durable Feed preferences 13/13, Community completion 21/21, Marketplace variants 26/26, fulfilment 28/28, Marketplace integrity 30/30 and independent Marketplace/Community controls 42/42. These are code-level contracts, not evidence of live infrastructure acceptance.

**Phase 5 disposition: NOT CLOSED for release.** The source work is advanced and the existing feature foundations are preserved, but RUN327, RUN328 and RUN329 still depend on external database, authoritative data and scanner-provider work. Marking Phase 5 fully complete before those gates pass would be unsafe and inaccurate.

## 2. Phase 6 kickoff — Profile and Identity performance

The repository's established Phase 6 track is Profile and Identity performance. This run starts its next hardening increment without creating a second profile store or changing social-graph authority.

### Ten Phase 6 objectives

1. **Bound identity keys:** reject empty, control-character and oversized relationship IDs before indexing.
2. **Bound graph memory:** cap each derived relationship set at 50,000 unique identities.
3. **Bound hydration batches:** default batch hydration to 500 identities, with a hard caller cap of 5,000.
4. **Preserve canonical graph ownership:** relationship indexes remain derived from canonical immutable social arrays only.
5. **Keep account cache isolation:** each ProfileDomain instance retains its own index cache.
6. **Invalidate by source identity:** replace only the derived set whose canonical array reference changed.
7. **Deduplicate work:** normalize and deduplicate batch IDs while preserving first-seen ordering.
8. **Preserve block-first policy:** block state remains decisive before follow, connection, match or message actions are derived.
9. **Fence stale UI reads:** retain abortable profile pagination and identity-switch request fencing.
10. **Keep sensitive domains separate:** wallet, PI/GHC balances, ledger, payment, payout and entitlement data remain excluded from public relationship indexes.

### Implemented in RUN330

- Added strict relationship-ID validation (maximum 256 characters; control characters rejected).
- Added a 50,000-entry hard cap for each derived relationship set.
- Added a 500-entry default batch limit and 5,000-entry absolute caller limit for `uniqueProfileIds`.
- Added runtime assertions for limit handling, malformed identifiers, cache reuse, per-domain isolation and memory caps.
- Extended the Phase 6 source contract to verify the new bounds.

## 3. Verification

- Phase 6 profile performance source gate: **23/23**.
- Phase 6 relationship-index runtime contract: **23 assertions passed**.
- Full `npm run verify:static`: **PASS** (exit 0) after the RUN330 changes.
- `npm run prebuild:checks`: **BLOCKED** because the workspace has no `node_modules` and cannot resolve the `typescript` package in `scripts/check-jsx-duplicate-props.mjs`.
- Supported Node 24.15.x dependency-backed typecheck, lint, and production build remain required. This workspace has Node 22.16.0 and no `node_modules`.

## 4. Safety and activation

No SQL was applied. No Testnet or Mainnet data/schema was changed. No Pi payment, GHC balance, reward, payout, seller settlement, entitlement or account mutation occurred. No GitHub push or Vercel deployment occurred. All scanner-unknown evidence remains quarantined. Election tally reconciliation remains pending and is not certification. Mainnet remains untouched; production is **NOT APPROVED**.
