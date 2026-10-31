# GreenHaven — Source of Truth & Prompt Execution Rules

**Current source version:** `0.222.0`
**Status:** source-audited; NOT APPROVED as a production release until the explicit runtime, database, provider and operator gates are completed.

## Authority order

When documents disagree, use this order and stop to reconcile conflicts rather than guessing:

1. **Executable source code** (`app/`, `components/`, `features/`, `hooks/`, `lib/`, `supabase/migrations/`).
2. **Current package/runtime metadata**: `package.json`, `package-lock.json`, `.nvmrc`, `vercel.json`.
3. **`docs/SOURCE_OF_TRUTH.md`** for project-wide release boundaries and prompt execution rules.
4. **`docs/PROJECT_TRUTH.md`** for current release metadata and verification limits.
5. **Current dated 2026-10-31 release/audit documents** for the specific feature they cover.
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

- Package version: `0.222.0`.
- Node requirement: `^24.15.0`; `.nvmrc` is `24.15.0`.
- Canonical Supabase migrations: **170 SQL files**.
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with the canonical directory.
- The latest repository archive was corrected to place the Next.js `app/` directory at repository root after a Vercel packaging failure caused by an extra wrapper directory.
- Static/source checks can pass without proving a Node 24 production build or live Supabase/Pi/Vercel behavior.
- Migrations are not considered applied merely because they exist in the repository.

## Current feature authorities

- Wallet / notification / premium UI: use the current 0.222.0 audit documents and executable wallet/notification source.
- Feed / post / curation / comments: use the current post-curation production document and executable social source.
- Community + Chat: Community membership and Chat membership are separate states; owner-controlled chat creation and approval ordering are authoritative in the current migrations/source.
- Regional context: server timestamps remain authoritative; viewer locale/timezone formats presentation; precise location is explicit opt-in and feature-scoped.
- Realtime/refresh: use the shared refresh coordinator and current shell/realtime implementation; do not restore removed polling merely because an old worklog used it.
- Economy/rewards: server-authoritative; no client minting and no GHC-per-view logic.

## Verification boundary

A passing static audit means source contracts are internally consistent. It does **not** mean:
- the 170 migrations are applied to Testnet/Mainnet;
- Pi provider payments/authentication work live;
- realtime infrastructure is configured in deployment;
- Node 24 `npm ci` + TypeScript + lint + Next production build has passed in the target environment;
- financial/payout/operator workflows are approved for Mainnet.

## Documentation hygiene

The repository intentionally keeps only current operational documents plus legacy documents that are still required by executable regression gates. New historical worklogs should not be added unless they are required as a test fixture. Feature truth belongs in current source and current canonical documentation, not an ever-growing chain of release notes.
