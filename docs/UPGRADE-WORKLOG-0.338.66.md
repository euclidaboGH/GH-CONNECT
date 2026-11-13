# Run #303 — Filter/search density and Vercel type-safety remediation

**Release candidate:** `0.338.66`  
**Base:** user-supplied `GREENHAVEN-0.338.64-RUN301-RELEASE-GATE-CI-FIXES.zip`, with Run #302 wallet hardening carried forward.  
**Scope:** Discovery, Messages, Communities, Marketplace, Wallet/GHC, Pi Payments, Rewards, Membership and shared search.

## Twenty targeted upgrades

1. Shared filter panels now start collapsed on both mobile and desktop.
2. The disclosure control is available at every breakpoint rather than mobile-only.
3. The closed panel uses the native `hidden` state, so it consumes no hidden tray height.
4. `aria-expanded` and `aria-controls` remain synchronized with the disclosure state.
5. Filter panels retain an explicit user-controlled open/close state rather than auto-opening when a filter changes.
6. A persistent primary-content slot keeps important search inputs visible while facets are closed.
7. Result counts remain visible in the compact header and announce updates politely.
8. Active-filter counts remain visible in the closed disclosure label.
9. The panel no longer forces all desktop filter controls into the page layout.
10. Community directory search is persistent; directory/topic/access/sort facets are collapsible.
11. Marketplace listing search is persistent; category/type/delivery/price/currency/date facets are collapsible.
12. Marketplace currency-specific numeric price rules remain unchanged.
13. Membership benefit search remains persistent; tier selection is collapsible.
14. Rewards ledger search remains persistent; status/date controls are collapsible.
15. GHC activity search remains persistent; transaction facets are collapsible.
16. Pi payment history search remains persistent; lifecycle facets are collapsible and remain read-only.
17. Messaging conversation search stays outside the filter tray, so inbox filters cannot hide it.
18. Match/discovery facets use the same compact disclosure pattern.
19. Discovery suggestion chips become a single horizontal strip; suggestion results are height-bounded and scroll independently, and focus dismissal no longer relies on a delayed timer.
20. Global search is bounded to the viewport with contained result scrolling; the Vercel TypeScript failure is fixed by rejecting a null/non-object Pi `/v2/me` response before reading its wallet address.

## Safety boundaries

- No migrations, database writes, RPC contracts, payment execution, settlement, ledger, wallet balance, withdrawal state, provider state, entitlement or authorization policy were changed by the filter/search redesign.
- The Pi consent guard only converts a missing or malformed `/v2/me` result into the existing safe `PI_TOKEN_INVALID` failure; it does not weaken wallet address verification.
- No dependency versions were changed and no environment variable or secret was read or modified.

## Verification

The current evidence is a **source-only verification scope** until the supported runtime and connected Preview are available.

- Required runtime: **Node.js 24.15.0** or a compatible newer Node 24 release.
- Run #303 source regression checks: 25 assertions (see `scripts/check-run303-filter-search-density.mjs`).
- Existing active-module filter-panel contract updated to the compact all-breakpoint disclosure contract.
- Existing Run #302 wallet-consent tests and full static suite must pass on the candidate.
- A full Vercel Node 24 production build and real Android/Pi Browser responsive acceptance are still required; source assertions do not replace those checks.

## GitHub/Vercel status

The supplied Vercel log proves that all 323 prebuild checks passed and Next.js compilation completed; the build then failed in TypeScript at `lib/server/identity/wallet-consent.ts:81` because `piUser` could be null. Run #303 fixes that specific failure. The log does not contain a GitHub error message, so no new GitHub root cause is inferred from it. Prior connected GitHub branch creation was rejected with `403 Resource not accessible by integration`; no remote branch/commit/PR can be claimed. No Vercel deployment has been created from this candidate. Production remains **NOT APPROVED** until GitHub write access is restored, a Testnet Preview builds successfully, and device/operator gates pass.
