# Upgrade worklog — 0.338.88 Research Studio & Public Forms Engine

**Base:** `GREENHAVEN-0.338.87-FIELD-RESEARCH-FOUNDATION-2026-11-16.zip`  
**Candidate:** `0.338.88`  
**Scope:** Field Research owner workflow, public response portal, durable storage, ecosystem navigation and migration inventory.

## Implemented

1. Added authenticated `/field/studio` owner workspace.
2. Added guided project types: survey, examination, election observation, registration and custom.
3. Added visual question builder for short/long text, single choice, multiple choice, dropdown, rating, number and date. Election observation, survey, examination and registration types receive purpose-specific starter questions. No JSON editing is exposed to form owners.
4. Added owner-authenticated project creation and private project listing.
5. Added draft/published/paused/closed status transition route.
6. Added interactive preview controls and publication UI.
7. Added cryptographically opaque public share slugs and `/r/[slug]` browser response page.
8. Public respondents do not need a GreenHaven account, Pi Browser or Field access code.
9. Added explicit consent capture, server-side required/type/choice/date/rating validation, bounded JSON bodies, durable rate limiting and submission idempotency keys.
10. Added private Research Inbox with owner check before response read.
11. Added Supabase tables for projects and responses; RLS enabled, anon/authenticated direct privileges revoked, service_role-only server access.
12. Added native share-sheet, WhatsApp, Facebook and GreenHaven Chat sharing entry points (Chat copies the URL and opens Messages for the owner to paste). Connected Ecosystem Field Research to Research Studio and retained the separate `/field` agent portal.
13. Synchronized package, lockfile, in-app release identity, migration source manifest, verified manifest, migration checklist and Testnet apply guide.

## Testnet migration

`20261116171144_gh_research_studio_public_forms` applied to GH Connect Testnet on 2026-11-16. Catalog verification confirms both tables exist, RLS is enabled, anon/authenticated SELECT is denied, and service_role SELECT/INSERT are allowed. The migration is marked REVIEW_REQUIRED for other targets and must not be replayed on Testnet.

Supabase advisor reports RLS-enabled/no-policy as INFO for these two tables. This is expected: direct client privileges are explicitly revoked and all data operations pass through authenticated server APIs using service_role.

## Verification

- `scripts/check-field-research-foundation.mjs`: 23/23.
- `scripts/check-migration-source-manifest.mjs`: 226/226.
- `scripts/check-run302-pi-withdrawal-hardening.mjs`: 35/35.
- New TS/TSX files: syntax transpilation passed.
- `scripts/check-project-truth.mjs`: run after current truth docs synchronization.
- Full project `tsc --noEmit`: blocked by existing syntax errors in unrelated files including `lib/server/economy/correlation.ts`, `lib/server/economy/public-id.ts`, `lib/server/economy/store.ts`, identity, media, membership, messaging and payment modules.
- Supported Node 24.15.0, dependency-backed lint/build and browser/device acceptance were unavailable in this workspace (Node 22.16.0; no node_modules).
- The supplied source archive omits `.github/workflows/ci.yml` and `.gitignore`; release-hygiene checks requiring those hidden files cannot run. Preserve the existing repository copies when syncing this bundle; do not fabricate replacements.

## Explicitly not completed

No image/video/audio/document upload path, conditional branching, draft editing/version history, timed examinations/scoring, election geographic hierarchy/tally reconciliation, agent assignments, notification routing into GreenHaven Chat, analytics/export, advanced role collaboration, or full Challenge-on-Post/Polls-on-Post transformations. Public responses are not verified election results.

No GitHub push or Vercel deployment. No Mainnet change. Production remains NOT APPROVED.
