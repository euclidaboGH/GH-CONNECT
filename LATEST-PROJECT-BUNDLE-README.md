# GreenHaven — Current Project Bundle

**Package:** `gh-connect@0.338.92`  
**Hardening program:** Phases 1–4 complete in source  
**Date:** 2026-11-17  

## Delivery identity
Record SHA-256 of each packaged zip after build.

| Artifact | SHA-256 |
|----------|---------|
| HARDENING phases 1–4 complete | *4c993d78a032f0ff644140c614bd81f9899e3e69bee299f73de43a5dd250673d* |

## Hardening summary
1. **Phase 1** — Address privacy hard-delete + CI proposal scan + route hardening  
2. **Phase 2** — Operator keys, JWT claims, cookie CSRF, CSP, approve hardening, rate limits  
3. **Phase 3** — Money/auth contracts, Playwright CI, supply chain, lint ratchet → 100, critical audit  
4. **Phase 4** — Central Supabase client (0 raw `/rest/v1/` under `lib/`), file splits, image opt flag, worklog archive  

## Gates
- Node 24.15+  
- No bulk migration push while REVIEW_REQUIRED remains  
- **Production remains NOT APPROVED**

## Key docs
- `docs/SOURCE_OF_TRUTH.md`
- `docs/HARDENING-PROGRAM-4-PHASES.md`
- `docs/HARDENING-PHASE4-STRUCTURE-RELEASE-PROGRESS.md`


## Previous implementation — Field Research foundation 0.338.87

Adds the Field Research ecosystem destination and redesigned `/field` agent workspace. The requested ten access codes are stored as SHA-256 digests in Preview-only Vercel variables for the `testnet` branch, with a dedicated HMAC session secret. The field report storage proposal was reviewed and applied to GH Connect Testnet as `20261116170409_gh_field_reports_public_intake`; postflight confirmed RLS and service-role-only access. See `docs/FIELD-RESEARCH-PLATFORM-UPGRADE-PLAN.md` for the 30-track programmes for Field Research, Challenge-on-Post and Polls-on-Post.


The previous 0.338.89 increment added basic conditional branching, durable Challenge-on-Post creation/join through a row-locked server RPC, and an additive REVIEW_REQUIRED schema foundation for research evidence, team roles, geographic hierarchy, election contests/candidates/assignments/tallies, timed examination attempts, poll policies and audit history. The earlier Research Studio migration `20261116171144_gh_research_studio_public_forms` remains applied and recorded on Testnet. New migration `20261116182000_gh_research_intelligence_platform_foundation` is source-only and unapplied. No Mainnet, GitHub push or Vercel deployment was performed. Full Node 24.15.0 dependency-backed build and browser/device acceptance remain outstanding. See `docs/UPGRADE-WORKLOG-0.338.89.md` and `docs/RESEARCH-STUDIO-USER-GUIDE.md`.


## Latest source increment — 0.338.92

Scoped Evidence Intake & Chain of Custody: public respondents can upload up to five evidence files through a project-scoped, submission-key-bound upload session; access-code field agents can upload against only reports created by their exact field-session JTI. Uploads are streamed through server-side SHA-256 hashing and magic-byte validation, then remain quarantined. A central Evidence Review Centre supports review after a trusted scanner attests clean; scanner queue and HMAC callback endpoints define the provider integration contract. Evidence creation, scan outcomes and review decisions are recorded in an append-only SHA-256 event chain. Active geographic unit IDs are validated, and election-observation projects require polling-unit-level IDs when supplied. Malware scanning itself still requires a separately operated trusted scanner; no provider is configured. New migration `20261117010001_gh_evidence_scoped_upload_chain_of_custody.sql` depends on migrations `20261116182000` and `20261116190000`; all three remain REVIEW_REQUIRED and unapplied. No GitHub push, Vercel deployment or Mainnet change was performed. See `docs/UPGRADE-WORKLOG-0.338.92.md` and `docs/SCOPED-EVIDENCE-USER-GUIDE.md`.


## Testnet-only environment preparation — 0.338.92

Vercel project `gh-connect` now has `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `GH_MEDIA_BUCKET=gh-media` configured for Preview branch `testnet` only. Production values are unchanged. Testnet still requires its own `SUPABASE_SERVICE_ROLE_KEY`, `GHC_FIELD_ADMIN_USER_ID`, and a trusted scanner worker plus `GHC_EVIDENCE_SCANNER_SECRET`. These were intentionally not fabricated or copied from Production. The scoped evidence migration now defaults both scanner states to `pending`. The three database migrations have not been applied.
