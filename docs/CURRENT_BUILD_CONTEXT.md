# CURRENT BUILD CONTEXT — Run #310 (2026-11-15)

- Current working candidate: **0.338.73**, derived from Run #309 / 0.338.72. Historical prompts, worklogs and older build-context snapshots are superseded by this current build context unless explicitly cited as historical evidence.
- Original uploaded baseline: **0.338.72** archive `GREENHAVEN-0.338.72-PHASE6-PERFORMANCE-ACCESSIBILITY-2026-11-14.zip` with SHA-256 `d8271fb74d1440e6397346e5b8e346de538923d3938470eac5f46feb2ec71f3c`; this remains the user's authoritative source-of-truth upload.
- Phase 6 source slice: independent feed privacy/preference/mute reads execute concurrently; post and comment public-identity hydration batches execute concurrently; bounded hydration and raw canonical cursor behavior remain unchanged.
- Phase 6 verification: source gate 23/23 PASS; full `npm run verify:static` 4,072 PASS / 0 FAIL; Core Web Vitals helper tests 16/16 PASS; privacy-safe RUM contract 17/17 PASS; Playwright spec added for reduced motion, responsive viewport bounds, keyboard focus and offline/reconnect announcements.
- Run #310 adds constant-memory CLS accumulation and bounded slow-interaction INP retention.
- Phase 5 durable preference migration remains `20261114100001_gh_feed_preferences_durable.sql`, classified `REVIEW_REQUIRED` and unapplied pending exact Testnet/Mainnet migration-history reconciliation.
- Runtime environment: Node 22.16.0, while `.nvmrc` and package engine require Node 24.15.0; project dependencies are not installed. Do not claim dependency-backed typecheck, lint or Next.js production build.
- No new migration, Supabase change, financial state change, GitHub push, PR or Vercel deployment was performed.
- Authenticated two-account browser journeys, Playwright execution, Android/Pi Browser, low-memory/constrained-network performance, live DB/RPC readiness and Vercel Preview acceptance remain outstanding.

**Release status: PHASE 6 NOT ACCEPTED; PRODUCTION NOT APPROVED.**
