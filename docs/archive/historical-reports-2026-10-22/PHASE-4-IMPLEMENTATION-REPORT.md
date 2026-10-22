> HISTORICAL RECORD — not current release status. Check `docs/PROJECT_TRUTH.md` and current CI evidence before relying on this report.

---

# GH-CONNECT Phase 4 Implementation Report

**Release source:** GH-CONNECT `0.63.20`  
**Scope:** GHC utility economy transparency and wallet policy integration  
**Status:** Source implementation complete; runtime/build/release gates remain open.

## Summary

Phase 4 adds a public, read-only GHC economy policy endpoint and integrates its server-derived pricing and safety disclosures into the GHC Wallet About tab. The aim is to make the utility model clearer to users without changing any financial behavior or economic constants.

## Implemented changes

- Added `GET /api/economy/policy`, returning versioned public policy, a base Daily Claim schedule, fixed-price uses, and current feature-gate disclosures. It contains no account or balance data and is intentionally public.
- Added `listPublicSpendCatalog()` as a safe projection of the authoritative server catalog. The client displays those prices but never decides or authorizes them.
- Integrated the policy endpoint into `features/wallet/wallet-screen.tsx` with loading and unavailable states, fixed price display, and explicit GHC utility/non-investment/no-guaranteed-redemption disclosures.
- Clearly labelled Daily Claim amounts as base gross values before scarcity and eligibility controls; they are not guaranteed payout amounts.
- Kept Pi-funded GHC acquisition unavailable because the pack catalog and durable ledger-credit settlement remain unwired. The existing withdrawal feature flag remains fail-closed by default, and the disclosure avoids treating an enabled flag as a settlement guarantee.
- Updated the wallet authorization regression scan to document and enforce the narrow public-policy exception: it may not include account-specific authentication or data.
- Added `scripts/test-phase4-ghc-utility-policy.mjs` and registered it in `ci:verify`.
- Bumped package/release metadata to `0.63.20` and regenerated the migration inventory manifest to eliminate existing manifest drift.

## Economic and architecture invariants preserved

- `ECONOMY_VERSION` remains `1.2`; no claim values, scarcity curve, reward issuance, transfer, membership, boost, or marketplace pricing rules were changed.
- No client minting, client-authoritative pricing, or pending-fund spending was added.
- GHC balances remain ledger-derived. Pi payment intents and GHC balances remain separate authorities.
- Company revenue journal and GHC utility ledger remain separate.
- No SQL migration was added or applied. No Supabase, Vercel, Cloudflare, Pi Network, or payment-provider state was changed.
- Cloudflare DNS/CDN/R2 remains a future provider integration; Supabase Storage remains the active storage path.

## Verification executed

- `scripts/test-*.mjs`: **134 scripts passed, 0 failed**.
- Project integrity audit: **36 passed, 0 errors, 0 warnings**.
- Release hygiene: **11/11 passed**.
- Production safety scan: **21 passed, 0 failed**.
- JSX safety: **704 files scanned, passed**.
- Dependency lock coverage/root version: passed.
- Migration inventory: **107 SQL files**, manifest synchronized (`79 REQUIRED / 1 REQUIRES_APPROVAL / 2 PROPOSAL / 25 REVIEW_REQUIRED`).
- Stage 2 financial source gates: all critical files/symbols present; **16/17 logical groups**. Disposable PostgreSQL and `scripts/operator-sql-stage2-smoke.sql` remain required.

## Not verified / must not be treated as passed

The available runtime is Node `22.16.0`, below the project-pinned `24.15.0`. The earlier clean npm install was blocked by registry DNS/network failure. Therefore TypeScript, ESLint, Next.js production build, and dependency-backed integration tests are not claimed as passing. No live Testnet, Pi Browser, Supabase RLS, provider reconciliation, or two-account tests were performed.

## Required next gate

1. Use Node `24.15.0` and run `npm ci --legacy-peer-deps` with working registry access.
2. Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run ci:verify` in that clean environment.
3. Test the Wallet About tab at mobile widths and in Pi Browser; confirm prices and policy match server responses.
4. Complete the Phase 3 revenue journal migration and concurrency/RLS tests against disposable PostgreSQL before connecting provider settlement events.
5. Do not deploy or apply migrations until the dependency-backed and database gates pass.
