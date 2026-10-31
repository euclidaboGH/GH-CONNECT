# GreenHaven — Pre-Push Source & Migration Audit

**Release:** 0.222.0  
**Audit date:** 2026-10-31  
**Scope:** complete current source tree, all canonical Supabase migrations, recent Wallet/Notifications/Refresh/Community/Home/Realtime/Post/Curation/Regional work.

## Result

**GitHub source push:** READY from static/source-integrity perspective.

**Supabase migration apply:** NOT APPROVED by this audit alone. The repository contains 56 `REVIEW_REQUIRED` migrations plus 1 `REQUIRES_APPROVAL` and 2 `PROPOSAL` migrations. Reconcile target migration history and validate reviewed migrations on disposable PostgreSQL/Testnet before applying.

## Migration inventory

- Canonical SQL migrations: **170**
- Executable GreenHaven tables: **137**
- REQUIRED: **111**
- REQUIRES_APPROVAL: **1**
- PROPOSAL: **2**
- REVIEW_REQUIRED: **56**
- Duplicate migration version prefixes: **0**
- Non-SQL files in `supabase/migrations`: **0**
- Hard destructive table/schema/database DDL: **0**
- Static RLS coverage: **137/137** executable tables
- Tables with explicit policies: **124**
- Operator/service-role allowlisted no-policy tables: **13**
- SECURITY DEFINER declarations with hardened search_path and PUBLIC execute revoke: **364**

## Findings fixed during this audit

### 1. Stale migration source manifest

`MIGRATION-SOURCE-MANIFEST.csv` contained an older 145-file inventory while the canonical migration directory contained 169 files. It has been regenerated and now contains all **170** migrations, including the new chat-governance follow-up.

A new `scripts/check-migration-source-manifest.mjs` gate now verifies filenames, classifications, ordering and byte sizes against the canonical migration directory. It is registered in both `verify:static` and `prebuild`.

### 2. Community Chat approval ordering defect

The original `20261031010001_gh_community_chat_governance.sql` approval function changed a pending chat request to `approved` before checking that the requester still had active Community membership. A stale/non-member approval could therefore leave an inconsistent approved request even though the function returned an error.

A follow-up migration, `20261031010002_gh_community_chat_review_membership_order.sql`, replaces that function so active Community membership is checked **before** request-state mutation or conversation enrollment.

The rule is now explicit:

**Community membership approval and Community Chat membership are separate states.**

### 3. Migration-policy ambiguity reviewed

The curation history intentionally contains an early self-curation guard followed by a display-only self-curation allowance. Later engagement/reputation migrations retain independent safeguards so self-curation cannot become independent reward evidence. This remains classified `REVIEW_REQUIRED` and is documented rather than silently rewritten as historical migration state.

## Static verification

`npm run verify:static` passes **57/57** and includes the new manifest consistency gate.

Additional migration checks pass:

- migration inventory synchronization;
- clean canonical migration naming;
- RLS coverage;
- SECURITY DEFINER ACL/search-path audit;
- migration release-readiness;
- database source contract;
- Community Chat governance;
- all recent Wallet/Notification/Refresh/Shell/Post/Curation/Regional contracts.

## Secret/source hygiene

- No `.env` secret files are present; only `.env.example` is included.
- No private-key material or live API-key patterns were found.
- No `.git` metadata is included in the release archive.
- `tsconfig.tsbuildinfo` is ignored by Git and is removed from the clean release archive.

## Important release boundary

This audit proves repository/source consistency; it does **not** prove that the 170 migrations are applied to any Supabase project. Before `supabase db push`, reconcile Testnet/Mainnet migration history independently and process every non-REQUIRED migration according to its classification.

The final production compiler/runtime gate remains Node **24.15+**, matching the project's `engines` and `.nvmrc` contract.
