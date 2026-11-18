# Upgrade Worklog — 0.296.0

## Phase 9 — RTL and accessibility foundation

- Added locale-aware keyboard skip navigation for Hausa, Igbo, Yoruba and Nigerian Pidgin preview packs.
- Added logical inline spacing/border/alignment utilities and opt-in directional icon mirroring.
- Added bidirectional isolation utilities and applied them to notification category counts and result counts.
- Added higher-contrast and forced-colors focus treatment, safe text reflow helpers and mobile input sizing.
- Consolidated locale direction logic so presentation metadata uses the canonical locale resolver.
- Bumped translation catalog version to 6; previous language approvals must be re-reviewed.

## Verification boundary

Source-only verification was run. TypeScript, lint, production build and browser E2E require Node.js 24.15.0 and a complete locked dependency install. This environment uses Node.js 22.16.0. No Supabase migration or runtime data changes were made.
