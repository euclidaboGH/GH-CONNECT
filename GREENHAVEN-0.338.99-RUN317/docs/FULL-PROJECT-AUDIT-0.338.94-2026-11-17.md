# GREENHAVEN full-project audit — 0.338.94 remediation candidate

**Audit date:** 17 November 2026  
**User-designated source archive:** `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip`  
**Working derivative:** `gh-connect@0.338.94`  
**Disposition:** Preview/build remediation candidate only; production remains **NOT APPROVED**.

## Executive summary

The archive is structurally intact and contains the full Next.js application, API routes, feature modules, scripts, documentation and 229 Supabase migration source files. The source includes extensive existing regression coverage and multiple prior security/reliability hardening passes. This audit made a narrow set of verified repairs rather than applying speculative broad changes to financial, identity or database paths.

## Confirmed findings and actions

### 1. Vercel build gate — repaired in local candidate

The latest connected `gh-connect-5p3o` deployment was `ERROR` on branch `testnet`, commit `97f48300bc23df27efb128907de4d7d906b46a59`. Its build log stopped at prebuild check 23/359 because `scripts/check-release-hygiene.mjs` requires a safe root `.env.example`, which was absent from the source archive. Added a credential-free template with blank server-only secrets, explicit public/server-only sections, Pi Testnet defaults and payout/A2U execution disabled. Release hygiene now passes 17/17.

Earlier preview build logs failed at stale navigation and marketplace checks. The marketplace premium check passes 25/25 in this archive. The navigation check expected the former five-item destination list while the actual shell renders six items. The current shell order is Home, Discover, Messages, Communities, Cart and Profile; Wallet remains an overlay. The platform essential-controls list and stale navigation contracts were aligned to that actual shell. Pass 38, Pass 40 and Phase 2 architecture checks now pass.

### 2. Source/release consistency — repaired in local candidate

Synchronized `package.json`, `package-lock.json`, `lib/app-release.ts`, README, current project truth, current acceptance metadata, current Phase 12 release metadata, the new versioned worklog and generated migration inventory to 0.338.94. Historical release snapshots remain historical. The canonical migration inventory remains 229 files with classifications 120 REQUIRED, 106 REVIEW_REQUIRED, one REQUIRES_APPROVAL and two PROPOSAL. These labels do not mean migrations are approved or applied.

### 3. Supabase Testnet — read-only security review

The project reports `ACTIVE_HEALTHY`. Security Advisor reports 16 RLS-enabled tables with no policies. Catalog inspection found:

- Five tables with only the postgres grant;
- Three tables with postgres/service_role grants;
- Eight tables whose ACL also includes anon/authenticated, but which still have no RLS policies and therefore do not expose rows through ordinary RLS-protected access.

Do not add permissive policies merely to silence the advisor. Review each table's intended client/server access, grants and route usage before changing anything. Performance Advisor reports 120 unused-index INFO findings. These are not automatic drop instructions; inspect workload coverage, index size, write cost, duplicate overlap and query plans before any removal.

### 4. Supabase Mainnet — read-only security review

Mainnet reports `ACTIVE_HEALTHY` and its Security Advisor flags `public.rls_auto_enable()` because its ACL includes anon/authenticated and it is SECURITY DEFINER. Catalog inspection shows the function is owned by postgres, has `search_path=pg_catalog`, and is bound to the enabled `ensure_rls` `ddl_command_end` event trigger for table-creation commands. This is an event-trigger function, not evidence by itself of an ordinary PostgREST RPC. Do not drop the function or event trigger, and do not change its ACL until the platform/event-trigger behavior and ownership requirements are separately reviewed. Mainnet was not modified.

### 5. Existing feature and security boundaries preserved

No wallet balance, ledger, reward issuance, withdrawal PIN, Pi wallet consent, A2U execution, payout, marketplace settlement, user identity, onboarding, authentication, or Coming Soon service activation behavior was intentionally changed. The three held research/evidence migrations remain unapplied. Evidence stays quarantined until a trusted scanner attests clean for the exact stored digest.

## Verification performed

The following 26 focused source-level checks passed with zero failures:

- Release hygiene 17/17; Run #300 22/22; Run #301 20/20; Run #312 28/28;
- Pass 38 12/12; Pass 40 12/12; Phase 2 architecture 17/17; adaptive shell 15/15;
- Phase 6 shell/navigation 21/21; performance/accessibility 23/23; essential upgrades 50/50;
- Run #305 12/12; Run #304 30/30; project truth 11/11; dependency-lock integrity;
- Wallet security 12/12; RLS source coverage; SECURITY DEFINER source audit;
- Ecosystem coverage 15/15; messaging/community 14/14; marketplace/community audit 42/42;
- Media evidence 22/22; scoped evidence 25/25; research intelligence 20/20;
- Migration source manifest 229/229; Phase 10 release closure 17/17.

The complete 359-check prebuild was not completed. A direct attempt stopped at check 16 because `npm ci` had not completed and the local `typescript` dependency was missing. The workspace provides Node.js 22.16.0, but the project requires Node.js 24.15.0. `npm ci --legacy-peer-deps` timed out before installing dependencies. Therefore full strict typecheck, lint, Next.js production build, full browser E2E, mobile/Pi Browser acceptance and dependency vulnerability audit are not claimed as passed.

## Changes not made

- No GitHub branch push or pull request.
- No Vercel deployment, promotion, rollback or production change.
- No Supabase DDL, migration, RLS policy, grant or data mutation.
- No Mainnet operation.
- No wallet/ledger/payment/payout/A2U mutation or Pi transaction.
- No trusted scanner activation or Coming Soon service activation.

## Required next gates

1. Run a clean install under Node.js 24.15.0 and complete all 359 prebuild checks.
2. Run full TypeScript, lint and Next.js production build; repair every real diagnostic.
3. Run current `npm audit --json` and resolve advisories through compatible, tested updates; do not use blanket `npm audit fix --force`.
4. Review Testnet RLS/grants table-by-table and unused indexes against actual query plans/workload.
5. Independently review Mainnet's event-trigger function and ACL; do not copy Testnet schema/history to Mainnet.
6. Complete scanner-provider, signed-upload and evidence-chain runtime verification.
7. Push the reviewed candidate to a non-production branch and validate its Vercel Preview before any production release decision.

**Final status: source-level remediation candidate prepared; full build and live acceptance pending; production NOT APPROVED.**
