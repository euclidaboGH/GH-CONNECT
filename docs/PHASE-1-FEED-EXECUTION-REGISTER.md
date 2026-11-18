# GreenHaven Phase 1 — Feed execution register

**Baseline:** `0.330.48`  
**Workstream:** Phase 1 — Feed reliability and functional acceptance  
**Overall status:** In progress; release acceptance is not approved.

This register tracks implementation evidence separately from the 150-target maintenance inventory. A source-contract pass is not treated as live database, browser, device, or production acceptance.

## Status vocabulary

- **Not started** — no implementation audit or change has been completed for this target.
- **Audited** — source and relevant contracts have been inspected; implementation or remaining gaps are documented.
- **Implemented, awaiting verification** — code changes are present, but the complete required acceptance evidence is not yet available.
- **Verified complete** — implementation and all applicable automated, integration, security, and user-experience acceptance evidence have passed.

## Feed work register

| # | Acceptance target | Status | Evidence / remaining work |
|---:|---|---|---|
| 1 | Canonical keyset cursor and deterministic ordering | **Implemented, awaiting verification** | Feed now consumes the server-issued `nextCursor`; append without a cursor fails closed; non-append refresh clears the previous cursor; repeated identical cursor is rejected; API advertises another page only when the returned raw page fills the requested limit. Source contract expanded and passes. Live database boundary/tie-timestamp checks remain. |
| 2 | Duplicate-safe reconciliation and overlapping refresh | **Audited** | Shared reconciliation helper deduplicates IDs, excludes deleted/blank IDs, preserves local-only continuity, and matches SQL `created_at DESC, id DESC`. Existing generation/AbortController logic provides latest-request-wins behavior. More integration tests under actual concurrent network conditions remain. |
| 3 | Composer media upload ownership, validation and retry | **Audited** | Composer validates media and blocks blob URLs at publish; server resolves private media IDs against authenticated ownership and ready status. Upload-session identity, asset immutability and finalization identity source checks pass. End-to-end retry, expired-session and cross-account upload tests remain. |
| 4 | Post create/edit/delete and mutation permission parity | **Not started** | Full route-by-route permission and ownership audit is still required. |
| 5 | Voting, comments, saves and sharing | **Audited** | Existing source gates cover deliberate voting, canonical action bar, bounded mutation payloads, comment previews and engagement journeys. Live multi-user permission and idempotency acceptance remains. |
| 6 | Block, mute, report and moderation enforcement | **Audited** | Feed route rechecks canonical visibility, fails closed when visibility/mute state is unavailable, requires author IDs, and filters muted authors server-side. Full report/appeal and cross-surface moderation acceptance remains. |
| 7 | Profile and community feed parity | **Audited** | Existing canonical post-card reuse and feed/profile/community contracts are present. Cross-surface live state parity and role-based community cases remain. |
| 8 | Loading, empty, offline, error and retry states | **Audited** | Existing feed distinguishes loading errors from empty results, preserves local state on refresh failure, exposes manual pagination fallback and online/offline messaging. Browser/device interaction acceptance remains. |
| 9 | Performance, accessibility and reduced-data behavior | **Audited** | Existing bounded media prefetch, reduced-data policy, accessible discovery rails, keyboard activation and focus-managed visibility explanation are covered by source gates. Real device profiling and assistive-technology acceptance remain. |
| 10 | Full Feed functional/security/regression acceptance | **Not started** | Requires dependency-backed Node 24.15.x build/typecheck/lint, live database cursor/concurrency tests, two-account authorization tests, browser/Pi Browser/mobile acceptance, and release evidence. |

## Changes in this work increment

- `contexts/ghc-context.tsx`: stores the canonical API cursor in a provider-owned ref; append requests consume that cursor rather than reconstructing it from the merged UI list.
- `contexts/ghc-context.tsx`: resets cursor state on replacement refresh so an old viewer's pagination cursor cannot be reused after a session/account change.
- `contexts/ghc-context.tsx`: fails closed if append is requested without a cursor and rejects a server response that repeats the exact cursor.
- `components/ghc/enhanced-feed-screen.tsx`: requests the next page through the provider cursor contract; no longer selects the oldest item from locally merged posts; a synchronous ref lock prevents duplicate observer/button requests before React state commits.
- `app/api/social/feed/route.ts`: only emits `nextCursor` when the raw server page fills the requested limit, avoiding a needless empty terminal request.
- `scripts/check-feed-keyset-ordering-0.330.48.mjs`: extended to enforce API cursor use, cursor reset, fail-closed behavior, non-advancement protection, and terminal-page semantics.
- `scripts/check-phase1-feed-completion-20261107.mjs`: updated its pagination contract to enforce the canonical server-issued cursor.

## Verification recorded in this increment

- Feed reconciliation runtime: **6/6 passed** (Node 22 with experimental TypeScript stripping).
- Feed reconciliation source contract: **12/12 passed**.
- Feed keyset/cursor source contract: **9/9 passed** after this increment.
- Feed completion contract: **31/31 passed**.
- Feed product transformation contract: **12/12 passed**.
- Feed experience Phase 15: **12/12 passed**.
- Post interactions Phase 16: **12/12 passed**.
- Social engagement journey Phase 17: **19/19 passed**.
- Deliberate voting: **10/10 passed**.
- Post/curation production contracts: **12/12 passed**.
- Media upload-session immutability: **8/8 passed**.
- Media asset immutability: **11/11 passed**.
- Media upload finalization identity: **11/11 passed**.
- Social upstream timeout contracts: **8/8 passed**.
- Independent hydration: **9/9 passed**.

## Explicitly unverified

- Node 24.15.x dependency-backed `npm run typecheck`, `npm run lint`, and `npm run build`. The available environment is Node 22.16.0 and has no `node_modules`; a global `tsc --noEmit` attempt therefore emitted missing React/Next/Node/dependency type errors and cannot establish a valid project typecheck.
- Live Supabase query-plan, cursor boundary, timestamp-tie and concurrency tests.
- Real Pi Browser, Android and desktop end-to-end acceptance.
- Two-user authorization and cross-account media ownership runtime tests.
- Production deployment and production readiness.

No database migration, production database mutation, Git commit, push, or deployment was performed in this increment.
