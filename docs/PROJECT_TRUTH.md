**Production status:** NOT APPROVED
# Current source increment — Run #310 / 0.338.73

Current status:** **NOT APPROVED**

Run #310 continues Phase 6 performance and accessibility hardening. The canonical social feed now overlaps independent visibility, durable-preference and mute reads while preserving fail-closed privacy checks. Public identity hydration overlaps post-author and comment-author batches without relaxing response, row, depth, identity, timeout or selected-field limits. Canonical raw-page cursor advancement is unchanged. RUM CLS now uses constant-memory session-window accumulation and bounded INP retention keeps later slow interactions. A Phase 6 source gate covers these performance/privacy contracts plus focus visibility, reduced motion, privacy-safe RUM and offline announcements; a Playwright spec covers reduced-motion behavior, responsive overflow, keyboard focus and offline/reconnect announcements.

**Current source version:** `0.338.79`  
**Phase 6 source gate:** 23/23 PASS; full static verification 4,072 PASS / 0 FAIL.  
**New migrations:** none.  
**Release integrity:** package, lockfile and app release metadata synchronized.

GHC and Pi pricing/settlement authorities remain separate. The source migration inventory is not evidence of applied migrations. No Supabase schema/data, wallet, GHC or Pi financial state was changed. No GitHub push, PR or Vercel deployment occurred. Source checks do not establish a successful supported-runtime build, real browser acceptance, live database readiness or production readiness; static verification does not establish runtime acceptance. Node 24.15.0 (`^24.15.0`) TypeScript, lint, and Next.js production build, Playwright, authenticated two-account journeys, Android/Pi Browser, constrained-network/device performance, database/RPC readiness and Vercel Preview checks remain outstanding. Phase 6 is **NOT ACCEPTED**; production remains **NOT APPROVED** and production approval remains pending.

Production remains **NOT APPROVED**.

## Canonical navigation contract

Bottom navigation (five items): **Home · Messages · Communities · Cart · Profile**.

Wallet remains an overlay surface and is not a primary bottom-nav destination.
