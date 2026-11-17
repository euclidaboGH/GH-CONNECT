# GREENHAVEN enabled-service transaction, interaction and UI audit — 0.338.95

**Date:** 17 November 2026  
**User-designated source archive:** `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip`  
**Working derivative:** `gh-connect@0.338.95`  
**Scope:** all enabled ecosystem services, transaction/state-transition integrity, interaction flows, screen layout contracts, responsive/accessibility/performance regression gates.

## Enabled-service inventory

The canonical registry contains 42 services: 12 ACTIVE and 30 COMING_SOON. The 12 active services are Community, GH Chat, Connections, Matches, Marketplace, Orders, Field Research, Wallet, GHC, Pi Payments, Rewards and Membership. All 30 Coming Soon services remain informational and have no interactive destination. No service was activated by this pass.

## Confirmed transaction-coordinator defect and repair

`lib/transactions.ts` previously marked registered operations as executed without calling an operation handler. Its rollback path marked operations rolled back without invoking a compensating action. This could create false confidence if reused as an atomicity primitive. Run 313 replaces that behavior with explicit ordered `execute` handlers and reverse-order `compensate` handlers. A missing executor prevents a false commit; a compensation failure is retained as a failed transaction; completed records remain queryable in bounded history. The module now explicitly states that it is an in-memory workflow coordinator, not a database transaction and never the authority for wallets, payments, rewards, orders or entitlements.

The existing only call site was local backup restoration in `contexts/ghc-context.tsx`. It has been removed from the fake transaction wrapper. Snapshot arrays are validated before mutation, then profile, settings, posts and conversations are applied in one state update, avoiding partially restored intermediate UI states.

## Service/UI regression scope

A 32-script enabled-service regression sample passed 32/32. Coverage included ecosystem registry and thirty-track plans; messaging transformation, composer, search, community interactions and governance; membership; rewards and withdrawal-PIN UX; profile; Wallet; Feed; Marketplace; identity/authentication; settings; navigation/responsive layout; filtering; social publishing; cross-domain settlement; withdrawal boundaries; A2U integration; and performance/accessibility.

The repository already contains eleven coordinated premium product surfaces and shared responsive/dark-mode/focus/reduced-motion contracts. The existing UI tests cover the compact header, touch targets, safe-area/nav placement, scroll/realtime behavior, offline recovery, keyboard access, responsive layout and screen transitions. This pass preserves those shared contracts rather than introducing an unreviewed competing design system.

## Additional defects found and corrected during verification

- The Run #305 Quiet Premium regression gate hard-coded version `0.338.94`; it now validates the synchronized semantic release identity rather than failing every subsequent version bump.
- The platform foundation check rejected safe local URLs and explicit Testnet environment defaults as though they were populated secrets. It now permits only the known local URL and `testnet` enum in addition to empty/boolean/numeric placeholders.
- `.env.example` now documents the registration bonus flag as disabled and uses the exact fail-closed `0` values expected by the wallet A2U release checks. Pi A2U, payout requests and payout execution remain disabled in the template; Testnet-only remains true.
- Documentation hygiene now classifies the existing 0.338.93/0.338.94 worklogs and 0.338.94 audit report instead of treating them as unclassified documentation.

## Verification evidence

- Run 313 transaction source gate: 8/8.
- Run 313 transaction runtime simulation: 12/12 assertions.
- Enabled-service regression sample: 32/32 scripts.
- Full static verification: 63/63.
- Run #300 release integrity: 22/22.
- Run #301 release gate: 20/20.
- Run #305 Quiet Premium interface: 12/12.
- Release hygiene: 17/17.
- Project truth: 11/11.
- Migration source inventory: 229 files; unchanged.
- Prebuild manifest: 361 checks enumerated in dry-run mode. The complete 361-check prebuild was not executed.

## Outstanding acceptance gates

Node.js 24.15.0 is required; this workspace currently has Node.js 22.16.0. Therefore dependency-backed typecheck, ESLint, full prebuild execution and Next.js production build are not claimed. Full browser E2E, Android/Pi Browser acceptance, actual Testnet payment lifecycle, trusted malware scanner/provider acceptance, and migration reconciliation remain outstanding. Supabase was not mutated.

## Safety / deployment disposition

No GitHub push, Vercel deployment, production promotion, Supabase DDL, migration application, RLS/grant change, wallet/ledger mutation, Pi transaction, A2U execution, payout enablement or Mainnet operation was performed. The 0.338.93 archive remains the user-designated source of truth; 0.338.95 is a local working derivative. Production remains **NOT APPROVED**.
