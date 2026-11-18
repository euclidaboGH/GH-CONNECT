# GREENHAVEN Run 314 — 30-screen experience upgrade audit

**Candidate:** `gh-connect@0.338.96`  
**User-designated source archive:** `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip`  
**Parent local derivative:** `0.338.95`  
**Disposition:** Local source candidate only; not pushed, deployed, or production-approved.

## Scope and implementation

Run 314 implements 30 numbered presentation and interaction refinements across the active product surfaces. The changes are intentionally additive and presentation-focused; they do not replace existing domain services or make the client authoritative for financial, order, reward, membership, or identity state.

| # | Area | Upgrade |
|---:|---|---|
| 1 | Shared shell | Bounded overscroll for nested module scroll regions |
| 2 | Shared shell | Consistent desktop reading rails for long-form screens |
| 3 | Shared shell | Safe-area-aware bottom spacing for scrollable product surfaces |
| 4 | Wallet | Centered wallet balance and metrics rail |
| 5 | Wallet | Stable numeric balance rendering and overflow protection |
| 6 | Wallet | Evenly sized four-action wallet control grid |
| 7 | Wallet | Consistent transaction-row alignment |
| 8 | Wallet | Better history-heading scroll positioning |
| 9 | Payments | Distinct, consistent payment recovery notice surface |
| 10 | Payments | Wallet sheets constrained to usable viewport height |
| 11 | Messaging | Centered inbox content with desktop reading width |
| 12 | Messaging | Clear conversation-row focus and hover affordance |
| 13 | Messaging | Wrapping conversation quick actions for narrow screens |
| 14 | Messaging | More readable message bubble measure and long-token wrapping |
| 15 | Messaging | Sticky message composer with safe-area padding |
| 16 | Communities | Responsive one/two/three-column community directory grid |
| 17 | Communities | Consistent full-height community card grid cells |
| 18 | Communities | Centered, bounded community hub content |
| 19 | Communities | Consistent touch interaction behavior for community controls |
| 20 | Marketplace | Consistent listing-grid alignment |
| 21 | Marketplace | Long listing titles constrained against horizontal overflow |
| 22 | Marketplace | Listing-detail columns aligned at desktop widths |
| 23 | Orders/Marketplace | Sticky purchase panel on wide listing-detail views |
| 24 | Marketplace | Unified seller and outcome centre surface treatment |
| 25 | Feed | Wider but controlled editorial post column |
| 26 | Feed | Layout containment for individual post slots |
| 27 | Feed | Improved sticky filter-toolbar backdrop |
| 28 | Profile | Centered, bounded profile content sections |
| 29 | Profile | Consistent profile timeline column width and rhythm |
| 30 | Rewards/Membership/Settings | Shared responsive content rail for summary and settings surfaces |

Component hooks were added for the wallet scroll region, conversation rows/bubbles/composer, community directory, marketplace listing grid, profile timeline and Rewards balance summary.

## Verification

- Run 314 source contract: **15/15 passed**.
- JSX safety: **1,154 files scanned, passed**.
- Full `npm run verify:static`: **passed (exit code 0)** after release metadata and documentation hygiene reconciliation. This includes the registered Run 314 source gate and the existing Run 313 transaction-coordinator regression checks.
- The workspace Node runtime remains **22.16.0**, while the project requires **24.15.0**. Dependency-backed TypeScript, ESLint and Next.js production build are not claimed.
- No screenshot, browser automation, Android device, Pi Browser, tablet, or desktop acceptance is claimed.

## Preserved boundaries

- The uploaded 0.338.93 archive remains the user's authoritative source of truth; 0.338.96 is a local working derivative.
- No GitHub push, Vercel deployment or production promotion was performed.
- No Supabase migration, DDL, RLS, grants, policy, or database mutation was performed.
- No wallet balance, ledger, withdrawal PIN, Pi consent, payment, payout, A2U, marketplace settlement, reward issuance, membership entitlement, or order state was changed.
- Pi payout requests and execution remain disabled in `.env.example`; `PI_A2U_TESTNET_ONLY=true` remains in place. Mainnet remains outside this release candidate.
- Coming Soon services remain unavailable and their registry status is unchanged.

## Required next acceptance

1. Run the complete install, typecheck, lint and production build on Node 24.15.0.
2. Review screenshots and interaction flows on Android, Pi Browser, tablet and desktop.
3. Exercise authenticated cross-account switching and the existing wallet/payment authorization boundaries in Testnet without moving real funds.
4. Reconcile held migrations and connected-provider prerequisites independently before any deployment decision.
5. Obtain explicit authorization before GitHub push, Vercel deployment, Supabase mutation, payout enablement, or Mainnet activity.

**Production remains NOT APPROVED.**
