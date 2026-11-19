# Phase 5 — Performance and security review

## Source-level checks

- Core Web Vitals p75 budgets are LCP 2,500 ms, INP 200 ms and CLS 0.1; the RUM collector is disabled by default, privacy-minimized and does not collect URLs, identities or cookies. Runtime budget tests cover sample sufficiency, percentile calculation and CLS/INP accumulation.
- Feed reads batch engagement hydration, enforce visibility/mute controls, use bounded pagination and account-switch response fencing. Adaptive feed batches, reduced-data prefetch and lazy media are bounded.
- Profile relationship hydration uses a bounded shared index; stale account requests are aborted and old-owner results cannot render.
- Service worker policy is network-only for APIs and excludes navigation/personalized/private/no-store responses from cache. Media prefetch respects reduced-data and network state.
- Supabase REST/RPC calls use the shared timeout transport; route-level direct fetch calls are deadline-bounded. Financial writes and high-risk social/auth mutations use durable per-user or operator rate limits.
- RLS, SECURITY DEFINER ACL/search_path, duplicate-index, FK-index and client-write-ACL source checks remain registered. No migration or live ACL change was applied in this pass.

## Targeted results

- Phase 3 RUM contract: 17/17; performance budget runtime: 16/16.
- Phase 6 performance/accessibility: 23/23; profile performance: 23/23.
- Phase 10 resilience: 17/17; settings/performance: 14/14; navigation/media: 9/9 plus 7/7 runtime.
- Feed controls/performance: 29/29; build-memory budget: 6/6; essential build/security hardening: 20/20.
- Ecosystem registry: 42 services / 10 categories / 11 Active / 30 Coming Soon / 1 Unavailable; provider isolation: 4 scenarios.
- Database/security contracts: identity mapping 10/10; SECURITY DEFINER ACL 8/8; function search_path 5/5; duplicate-index review 5/5; RLS policy review 5/5; FK-index review 4/4; client-table write ACL 20/20; community integrity 53/53; social publishing 42/42; feed/profile integrity 48/48.
- The complete 379-command static verification inventory passed in three bounded batches (130 + 130 + 119). The monolithic npm process exceeded the 120-second execution window; this is not a full production build or live-runtime certification.

## Runtime limits

No real mobile/tablet/desktop screenshot sweep, network-throttled browser run, memory heap profile, production Core Web Vitals sample, database query-plan benchmark, concurrent multi-instance load test or live RLS penetration test was executed in this workspace. The source harnesses and static/runtime contracts exist, but measured runtime performance and live access control remain unverified. Do not infer a performance score from static checks.

## Additional runtime harness — 2026-11-19

Added `e2e/phase5-runtime-acceptance.spec.ts` and `npm run test:e2e:phase5`. On an explicitly enabled Preview/Testnet target, it:

- checks horizontal overflow at 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS-pixel viewport widths;
- records DOMContentLoaded, load event, transferred resource bytes/count, LCP when the browser exposes it, and JS heap when Chromium exposes it;
- runs eight simultaneous authenticated feed reads and rejects HTTP 500 responses or server-credential leakage;
- refuses Production and requires explicit Testnet opt-in; concurrency requires a real Testnet session cookie.

The browser suite has **not** been executed here: Playwright dependencies and real Testnet credentials are not present. Its thresholds are deliberately limited to a broad 20-second DOMContentLoaded smoke ceiling; it does not claim Core Web Vitals compliance. Heap and LCP are reported as nullable measurements because browser support varies.

### Live Vercel observation (2026-11-19 12:53 UTC)

- Vercel project `gh-connect-5p3o` (`prj_ZgFsTnpcSGkJPFRAeuJJeSq2dvoZ`), team `GreenHaven's projects`.
- Latest observed `testnet` Preview deployment: `READY`, deployment `dpl_Czqmaaoftb9pCqcsBptWUjmTAbrv`, region `dub1`, alias `gh-connect-5p3o.vercel.app`.
- That deployment's Git commit is `787ab56ef4f2b6ad4d054c4357c0fab43c684bc7`; it is not the 0.338.105 source candidate or the 0.338.106 configuration-only derivative reviewed afterward.
- Vercel's Preview runtime log query returned no matching warning/error/fatal records in the 30-minute window ending 12:53 UTC. This is not proof of no user-facing errors or no requests; the Hobby plan's log retention and event coverage limit the inference.
- A grouped request-path query returned no rows. No page-level synthetic journey, real-user Core Web Vitals, DB query plan, heap profile or concurrent multi-instance load test was thereby established.
