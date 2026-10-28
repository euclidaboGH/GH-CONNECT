# Upgrade worklog — v0.152.0

- Release version synchronized to `0.152.0` across package metadata, lockfile root, app release, README, project truth, and verified manifest.
- Public profile hydration now times out after five seconds and rejects unsafe photo URL forms.
- Navigation inputs and event payloads are bounded before dispatch.
- Pi transaction history rejects malformed supplied amounts.
- Added regression checks to Phase 3, Phase 6, and Phase 9 gates.
- Added `docs/UPGRADE-0.152.0-PHASE1-12-HARDENING.md`, containing ten scoped upgrade tracks for every phase (120 work items total) and clearly distinguishing implemented changes from work that still needs execution.
- Verification: Phase 1–12 consolidation 21/21; Phase 3 identity 12/12; Phase 6 navigation 16/16; Phase 9 transaction integration 33/33; project truth 10/10; Phase 12 readiness 20/20; static suite 35/35.
- Node available during source verification: 22.16.0. Project requires Node `^24.15.0`; TypeScript, lint, production build, browser E2E, PostgreSQL restore, and Pi Testnet were not claimed as passed.
