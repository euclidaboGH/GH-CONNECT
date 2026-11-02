# GreenHaven — Source of Truth & Prompt Execution Rules

**Current source version:** `0.274.3`
**Status:** source-audited; NOT APPROVED as a production release until the explicit runtime, database, provider and operator gates are completed.

## Authority order

When documents disagree, use this order and stop to reconcile conflicts rather than guessing:

1. **Executable source code** (`app/`, `components/`, `features/`, `hooks/`, `lib/`, `supabase/migrations/`).
2. **Current package/runtime metadata**: `package.json`, `package-lock.json`, `.nvmrc`, `vercel.json`.
3. **`docs/SOURCE_OF_TRUTH.md`** for project-wide release boundaries and prompt execution rules.
4. **`docs/PROJECT_TRUTH.md`** for current release metadata and verification limits.
5. **Current dated release/audit documents** (including the Phase 1 foundation audit) for the specific feature they cover.
6. **Referenced legacy verification documents** exist only because older regression scripts still validate them. They are historical fixtures, not current design authority.

## Prompt execution rule

Do **not** use an old worklog, phase note, archive note, or historical release document as the basis for changing current behavior when executable source disagrees with it.

For implementation prompts:
- inspect current source first;
- inspect the relevant current audit/release document second;
- treat legacy documents as background only;
- never resurrect a removed UI, route, migration, architecture, or product rule solely because an old document mentions it;
- if two current sources conflict, report the conflict before making a broad change.

## Current release facts

- Package version: `0.274.3`.
- Node requirement: `^24.15.0`; `.nvmrc` is `24.15.0`.
- Canonical Supabase migrations: **176 SQL files**.
- The one authoritative canonical migration count is **176 individual files** in `supabase/migrations/`. The consolidated bundle contains those same 176 sources in one review document. Counts of all `.sql` files include operator/validation/reset assets and the bundle, and are not migration counts. Historical software versions such as `0.184.0` or `0.187.0` are version labels, not counts of migrations.
- Consolidated canonical migration source bundle: `supabase/GH-CONNECT-CANONICAL-MIGRATION-BUNDLE-0.274.3.sql` contains all 176 canonical migration sources with per-file SHA-256 and classifications for one-document review. It is explicitly **not executable as a monolithic installer**; reconcile target history and apply reviewed original files individually.
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with the canonical directory.
- The legacy `supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql` is stale (132 of 176 migrations represented; 44 omitted) and MUST NOT be used for install/recovery; use individually reviewed canonical migrations after target-history reconciliation.
- The latest repository archive was corrected to place the Next.js `app/` directory at repository root after a Vercel packaging failure caused by an extra wrapper directory.
- Static/source checks can pass without proving a Node 24 production build or live Supabase/Pi/Vercel behavior.
- Migrations are not considered applied merely because they exist in the repository.

## Current feature authorities

- Wallet / notification / premium UI: use the current feature audit documents and executable wallet/notification source.
- Feed / post / curation / comments: use the current post-curation production document and executable social source.
- Community + Chat: Community membership and Chat membership are separate states; owner-controlled chat creation and approval ordering are authoritative in the current migrations/source.
- Regional context: server timestamps remain authoritative; viewer locale/timezone formats presentation; precise location is explicit opt-in and feature-scoped.
- Realtime/refresh: use the shared refresh coordinator and current shell/realtime implementation; do not restore removed polling merely because an old worklog used it.
- Economy/rewards: server-authoritative; no client minting and no GHC-per-view logic.

Phase 4 marketplace cart and checkout integrity is documented in `docs/PHASE-4-MARKETPLACE-CART-CHECKOUT-INTEGRITY-2026-11-01.md`. The cart remains client-side convenience state; server listing/order/payment authorities are authoritative, and the Pi handoff is intentionally limited to one Pi order at a time.

## Verification boundary
## Verification boundary

A passing static audit means source contracts are internally consistent. It does **not** mean:
- the 176 canonical migrations are applied to Testnet/Mainnet;
- Pi provider payments/authentication work live;
- realtime infrastructure is configured in deployment;
- Node 24 `npm ci` + TypeScript + lint + Next production build has passed in the target environment;
- financial/payout/operator workflows are approved for Mainnet.

## Documentation hygiene

The repository intentionally keeps only current operational documents plus legacy documents that are still required by executable regression gates. New historical worklogs should not be added unless they are required as a test fixture. Feature truth belongs in current source and current canonical documentation, not an ever-growing chain of release notes.

## Pi wallet repair status (2026-11-01)

Phase 1 adds a server-verified Pi identity reconnect action to the unified earnings dashboard. See `docs/PHASE-1-PI-IDENTITY-AND-AUTHORIZATION-RECONNECT-2026-11-01.md`. It does not enable A2U payout execution or imply production approval.

## Pi wallet action routing (2026-11-02)

Phase 2 clarifies the Pi wallet card's Withdraw, Eligibility, and Identity actions and connects them to the unified earnings dashboard. The dashboard now exposes server-provided eligibility reasons and deployment-gate state, while keeping verified identity, payout consent, eligibility, and actual payout execution distinct. See `docs/PHASE-2-PI-WALLET-ACTION-AND-ELIGIBILITY-UPGRADE-2026-11-02.md`. Do not infer production payout readiness from these UI changes or source-contract tests.

PI wallet Phase 3 (2026-11-02): added authenticated user-scoped withdrawal status/history, safe error boundaries for payout request/status/execution endpoints, ambiguous-outcome idempotency retention, and client-side blocking of overlapping unresolved requests. See `docs/PHASE-3-PI-WITHDRAWAL-STATUS-RECOVERY-2026-11-02.md`. This does not enable payout gates or constitute live Testnet proof.

The 2026-11-02 pre-GitHub audit and staged 100-feature roadmap are in `docs/PRE-GITHUB-COMPREHENSIVE-AUDIT-AND-100-FEATURE-ROADMAP-2026-11-02.md`. Its 100 entries are planned feature candidates, not a claim that all have been implemented. The read-only audit gate runs at the beginning of `prebuild` and `verify:static`; production remains blocked pending supported-runtime and live environment evidence.
