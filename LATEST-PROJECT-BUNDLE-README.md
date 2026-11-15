# GreenHaven — Current Project Bundle

**Current candidate:** `gh-connect@0.338.73` — Run #310, 2026-11-15  
**Authoritative uploaded baseline:** `GREENHAVEN-0.338.72-PHASE6-PERFORMANCE-ACCESSIBILITY-2026-11-14.zip`  
**Baseline SHA-256:** `d8271fb74d1440e6397346e5b8e346de538923d3938470eac5f46feb2ec71f3c`

## Latest delivery

- Phase 6 performance hardening runs independent feed visibility, durable preference and mute reads concurrently, and runs bounded post/comment profile hydration batches concurrently without weakening privacy or identity constraints.
- Phase 6 source gate: 23/23 PASS. CLS tracking now uses constant memory; bounded INP samples preserve later slow interactions.
- Targeted Core Web Vitals regression tests: 16/16 PASS; privacy-safe RUM contract: 17/17 PASS. Full `npm run verify:static`: 4,072 PASS / 0 FAIL. Playwright coverage added for reduced motion, responsive overflow (320–1440px), keyboard focus and offline/reconnect announcements.
- Phase 5 durable account-owned feed preferences, Phase 4 community completion and Phase 3 creator-media source closeout remain included.
- See `docs/UPGRADE-WORKLOG-0.338.73.md` for implementation, evidence and blockers.

## Candidate archive

`GREENHAVEN-0.338.73-PHASE6-PERFORMANCE-ACCESSIBILITY-2026-11-15.zip`

## Required release gates

The working environment has Node 22.16.0, while the project requires Node 24.15.0, and dependencies are not installed here. TypeScript, ESLint, Next.js production build, authenticated browser/device and two-account acceptance remain outstanding.

Supabase inspection was read-only. Testnet contains the canonical community RPCs/tables and service-role-only function grants, but its 40-entry migration ledger must be reconciled with 223 repository migration sources. Mainnet migration history returned zero entries and canonical community RPCs were absent; `public.rls_auto_enable()` SECURITY DEFINER execution grants require separate review. No database changes were made.

No GitHub push, pull request, Vercel deployment or production approval was performed. Production remains **NOT APPROVED**.
