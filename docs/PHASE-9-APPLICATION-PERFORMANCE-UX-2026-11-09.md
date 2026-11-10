# Phase 9 — Application Architecture, Performance & UX Implementation Report

**Source baseline:** `gh-connect@0.338.13`  
**Implementation date:** 2026-11-09  
**Scope:** Application performance measurement correctness and tab-level telemetry attribution  
**Database changes:** None  
**Financial or authorization behavior changes:** None

## Work completed

### 1. Corrected per-surface Core Web Vitals attribution in the tabbed application

The app is a tabbed SPA whose primary surfaces live under a shared pathname. The previous collector classified samples using only `location.pathname`; for the root app this caused activity from multiple tabs to be reported as `home`, making per-surface performance analysis misleading.

The collector now attributes:
- LCP to the tab containing the reported largest-contentful-paint element;
- INP interactions to the tab containing the interaction target;
- CLS shifts to the tab containing the first reported layout-shift source;
- events without a resolvable element to the currently active tab as a bounded fallback.

The `matches` primary tab is now represented in the allowed surface taxonomy. CLS is emitted only for surfaces where a layout-shift stream was observed; the collector no longer manufactures zero-CLS samples for tabs that were never visited. Samples remain coarse and allowlisted: no URL, query string, user ID, cookie or free text is added.

The collector remains opt-in and dark by default (`NEXT_PUBLIC_RUM_SAMPLE_RATE=0`). Telemetry remains best-effort, rate-limited, non-durable and excluded from financial or authorization decisions.

### 2. Corrected minimum-sample evaluation

`evaluateSurfaceBudget` previously used the raw array length to decide whether enough samples existed, even though percentile calculation filters invalid values. A batch containing many invalid values and only one valid measurement could therefore be treated as a sufficiently sized sample set.

The evaluator now counts only finite, non-negative measurements. The returned sample count reflects valid observations, and a surface cannot receive a budget pass until the required number of valid samples is present.

### 3. Kept telemetry payloads bounded

The RUM batch validator now accepts up to 30 coarse samples so the collector can report multiple tab/metric pairs in a single bounded request. The endpoint's existing 4 KiB request-body limit, strict field allowlist, rate limit and `no-store` response policy remain in force.

### 4. Reconciled source-release hygiene exposed by the full suite

The archive contained a generated `.cache/tsconfig.tsbuildinfo` artifact despite the repository already ignoring `.cache/`. The artifact was removed from the source release. Five current 2026-11-09 audit/inventory documents and this Phase 9 report were added to the documentation-hygiene classification registry. Stale release labels in two explicitly legacy verification fixtures were reconciled to the 0.338.13 archive while their historical-snapshot status remains explicit. The current consolidated audit register remains the controlling audit record.

## Changed files

- `lib/web-vitals-collector.ts`
- `lib/performance-budgets.ts`
- `scripts/test-phase3-performance-budgets.mjs`
- `scripts/check-phase3-performance-rum.mjs`
- `scripts/check-doc-hygiene.mjs`
- `docs/PHASE-9-APPLICATION-PERFORMANCE-UX-2026-11-09.md`
- `docs/UPGRADE-WORKLOG-0.338.13.md`
- `docs/PHASE-1-12-SYSTEM-WIDE-ACCEPTANCE.md` (legacy fixture version marker only)
- `docs/PHASE-12-FINAL-INTEGRATION-RELEASE-READINESS.md` (legacy fixture version marker only)
- Removed generated `.cache/tsconfig.tsbuildinfo` from the source release

## Verification executed

| Check | Result |
|---|---:|
| Performance budget unit tests | 14/14 |
| RUM source/privacy/attribution gate | 17/17 |
| Architecture decomposition | 8/8 |
| Cross-surface reliability | 13/13 |
| Service-worker/media resilience | 17/17 |
| UI/navigation/responsive audit | 31/31 |
| Settings/performance controls | 14/14 |
| Accessible navigation | PASS |
| Full `npm run verify:static` suite | PASS — 57/57 consolidated checks; follow-on documentation hygiene and cross-domain checks also pass |

These are source-level and deterministic unit checks. They are not browser/device or production runtime measurements.

## Remaining Phase 9 acceptance work

The archive environment reports Node `22.16.0`, while this project requires Node `^24.15.0`; `node_modules` is absent. Consequently, supported-runtime TypeScript checking, ESLint and the Next.js production build were not established in this pass. Physical Android, Pi Browser, keyboard/screen-reader, network-throttling and responsive screenshot acceptance also remain open. Runtime Core Web Vitals baselines cannot be claimed until the collector is deliberately enabled in an approved environment and sufficient real-user samples are collected.

## Safety and release boundary

No SQL migration was added or applied. No live Supabase/Testnet/Mainnet operation was performed. No wallet, GHC balance, Pi payment, marketplace order, inventory, membership entitlement, payout, refund or ledger behavior was changed. No production approval is implied.

**Phase 9 status:** targeted source-level implementation completed; full phase acceptance remains open pending supported-runtime build and real browser/device evidence.
