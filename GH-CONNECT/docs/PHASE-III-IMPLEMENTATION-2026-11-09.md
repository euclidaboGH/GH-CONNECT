# Phase III — Global scale, intelligence and operational excellence (Implementation Pass 1)

**Date:** 2026-11-09  
**Baseline:** GREENHAVEN 0.338.6 (Phase II closeout pass 4)  
**Status:** IN PROGRESS — package #21 source foundation delivered; packages #22–#30 not started. **Production remains NOT APPROVED.**

## Phase II carry-over (still open)

Phase II source work is complete, but responsive screenshots, physical Android/Pi Browser acceptance and Node 24.15.x typecheck/lint/build were not run (see `PHASE-II-IMPLEMENTATION-2026-11-09.md`, pass 4). Phase III proceeds in parallel; those acceptance items stay open and block any production claim.

## #21 Performance budgets and real-user monitoring

**Audit.** `lib/analytics-service.ts` already observed LCP/FID/layout-shift, but it reported every raw LCP candidate, used deprecated FID instead of INP, emitted per-shift CLS rather than the session-window metric, carried no route/device/network dimensions, had no budgets, and `/api/analytics/events` does not persist (`durable:false`). No web-vitals dependency exists.

**Delivered (dark by default):**
- `lib/performance-budgets.ts` — pure contract: CWV p75 thresholds (LCP 2.5 s, INP 200 ms, CLS 0.1; poor at 4 s / 500 ms / 0.25), per-surface budgets, nearest-rank percentile, budget verdicts that return *unknown* (never pass) below 30 samples, correct CLS session-window and INP computation, coarse device/connection buckets, strict allowlist beacon validator, fail-closed sampling parser.
- `lib/web-vitals-collector.ts` — browser collector, **off unless `NEXT_PUBLIC_RUM_SAMPLE_RATE` > 0** (default 0). One beacon per page view on hide; surface/device/connection buckets and metric values only — no URL, query, user ID, cookie or free text.
- `app/api/analytics/vitals/route.ts` — anonymous intake: 4 KB body cap, IP rate limit, server-side re-rating, unknown keys dropped. **Does not persist** and answers `durable:false`.
- 14 behavioural tests (`scripts/test-phase3-performance-budgets.mjs`) and a 13-check gate (`scripts/check-phase3-performance-rum.mjs`), registered in `prebuild`, `verify:static`, `check:phase3-performance`.

**Not delivered / limits:**
- No durable storage or p75 aggregation: that needs a reviewed migration, retention policy and disposable-Postgres rehearsal. Until then the "p75 met on representative traffic" and "regressions block rollout" acceptance criteria are **unmet**.
- The app is a tabbed SPA; the collector derives the surface from the pathname, so in-app tab navigation is attributed to `home`. Tab-aware attribution needs the shell to expose the active tab.
- JS-payload, API-latency, feed-render-time and image-byte budgets are not yet instrumented; CI bundle-size budgets need an installed build.
- No real device traces, no Node 24.15.x typecheck/lint/build. The collector was not exercised in a browser.

**Safety:** no financial, wallet, payment, reward, order or entitlement code changed; no migration, dependency, lockfile or version change; no push or Mainnet capability enabled.

## Phase III package status

| # | Package | Position |
|---|---|---|
| 21 | Performance budgets and RUM | Source foundation shipped dark; storage/aggregation/CI budgets pending |
| 22–30 | Observability, query scale, locale, accessibility, offline, privacy, AI, flags, supply chain | Not started |

## Next

1. Tab-aware surface attribution and a reviewed storage design (migration proposal only, not applied) for #21.
2. #22 OpenTelemetry correlation IDs and redaction contract, again pure-first and dark.
3. Run Node 24.15.x verification and the Phase II device matrix.
