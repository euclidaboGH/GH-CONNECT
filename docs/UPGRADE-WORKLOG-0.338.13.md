# Upgrade worklog — 0.338.13

## Baseline

- Working input: `GREENHAVEN-0.338.12-PHASE1-MESSENGER-COMMUNITY-FOUNDATION.zip`.
- Original user-authoritative archive remains 0.338.9; 0.338.10, 0.338.11, 0.338.12 and 0.338.13 are derived working increments.

## Phase 1 implementation

- Added durable actor-to-target conversation nicknames. A user can set or clear a private alias for another active member; aliases are scoped to actor + conversation + target and are not shared with the target or other participants.
- Added per-member quick-reaction preference and read-receipt preference.
- Updated the authenticated read-mark RPC so disabling read receipts suppresses receipt writes while still advancing the user's own unread/read cursor.
- Added authenticated GET/PATCH conversation-controls API contracts. Session identity supplies the actor; nickname targets must be active members; input sizes and values are bounded; service-role-only RPCs enforce membership again.
- Confirmed existing message edit and pin API/RPC contracts remain in place: edits are sender-only; pinning requires active conversation membership; deleted messages cannot be edited/pinned.
- Added generated PostgreSQL `tsvector`, GIN index, and a server-side full-history search RPC. It rechecks active membership in the database, excludes deleted messages, bounds query/limit/offset, and returns ranked/paginated results.
- Connected the active thread search UI to the server endpoint. Search is no longer restricted to the currently loaded in-memory window when durable messaging is enabled.
- Added a source-contract regression gate, a disposable-transaction Testnet SQL acceptance fixture covering active-member/outsider search, nickname target checks, read-receipt opt-out, sender-only edit and member-only pin, and updated the legacy search gate to the new server-search behavior.

## Migration and safety status

- Added `20261109100001_gh_messaging_phase1_controls_search.sql`.
- Classified it `REVIEW_REQUIRED` in migration inventory and Testnet apply order. It is NOT applied and is not authorized for automatic deployment.
- RPC execute is granted only to `service_role`; client table access remains denied by RLS. Search RPC checks membership itself; API derives actor from authenticated session and rate limits requests.
- No financial tables, payment execution, wallet authority, authentication bypass or RLS relaxation was introduced.

## Validation

- Phase 1 closeout contract: 16/16 PASS.
- Phase 1 information-centre contract: 15/15 PASS.
- Messenger transformation contract: 14/14 PASS.
- Full-history search UI contract: 10/10 PASS.
- Existing messaging JSON, doc hygiene, migration inventory and repository gates are included in final run log.
- The SQL acceptance fixture is prepared but has NOT been executed against a live database. Static/source checks are not live database verification. No connected Testnet/Mainnet database was queried; no migration was applied; PostgreSQL execution, two-account positive/negative membership tests, Node 24.15.0 typecheck/lint/build and browser/device verification remain outstanding.

## Phase 1 status

The durable controls, edit/pin contracts and server-search implementation are source-complete. Phase 1 is NOT cleared to advance to Phase 2 until the new migration is reconciled against both remote histories, approved and tested on Testnet; two-account membership isolation is demonstrated; and the remaining Phase 1 workflows (contact sharing and group creation from conversations) are confirmed end-to-end. Production remains NOT APPROVED.


## Phase 9 — application performance and UX follow-up (2026-11-09)

- Source baseline for this follow-up: `gh-connect@0.338.13`.
- Corrected Core Web Vitals attribution for the tabbed SPA: LCP is attributed to its element-owning tab, INP to the interaction target's tab, and CLS to the originating layout-shift source. The `matches` tab is included in the allowed surface taxonomy.
- Corrected performance-budget minimum sample evaluation to count only finite, non-negative observations; invalid values cannot inflate the sample threshold.
- Expanded the strict bounded RUM batch maximum to 30 samples while retaining the endpoint's 4 KiB body cap, allowlisted fields, rate limit, no-store response, and non-durable status.
- Targeted checks: performance budget tests 14/14; RUM privacy/attribution source gate 17/17; architecture decomposition 8/8; cross-surface reliability 13/13; resilience 17/17; UI/navigation/responsive audit 31/31; settings/performance controls 14/14; accessible navigation PASS.
- Full `npm run verify:static` completed successfully: consolidated static verification 57/57, documentation hygiene PASS, and all follow-on registered source/runtime-contract checks passed. Verification is source-level only. Available runtime is Node.js 22.16.0, below required Node.js 24.15.0; `node_modules` is absent. Typecheck, ESLint, production build and browser/device acceptance are not claimed.
- No migration, database, Pi/GHC, wallet, order, inventory, payout, refund, entitlement or ledger state was changed.


## Phase 10 — release engineering and independent acceptance (2026-11-09)

- Added `scripts/check-phase10-release-closure.mjs` to enforce synchronized version/runtime pins, dependency-lock check ordering, full static verification in CI, explicit typecheck/lint/build gates, migration review gates, and production NOT APPROVED status.
- Registered release hygiene, project truth and the new closure contract in both `prebuild` and `verify:static`.
- Updated GitHub Actions to run the complete `npm run verify:static` suite after `npm ci` and before typecheck/lint; the production build remains a separate job gated on static success.
- Added `docs/PHASE-10-RELEASE-ENGINEERING-ACCEPTANCE-2026-11-09.md` and registered it with documentation hygiene. Programme completion state remains `Implemented, awaiting verification`.
- Baseline evidence before this increment: full `npm run verify:static` exit 0; release hygiene 11/11; project truth 10/10; dependency-lock integrity PASS; migration structure inventory 199 files; security headers 7/7; accessibility 12/12; platform acceptance 24/24; uploaded ZIP integrity/path/secret-file scan PASS.
- Environment remains Node 22.16.0 with no installed dependencies, below required Node 24.15.0. The post-change full `npm run verify:static` suite completed with exit 0; Phase 10 release closure 16/16, release hygiene 11/11, project truth 10/10 and documentation hygiene passed. Node 24 `npm ci`, TypeScript, ESLint, Next.js build, remote GitHub Actions, browser/device, live PostgreSQL, Pi Testnet and operator acceptance are not yet established. No database migration or live service was changed. Production remains NOT APPROVED.
