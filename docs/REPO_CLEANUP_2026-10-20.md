# Repository cleanup — 2026-10-20

Removed safely:
- 74 root-level historical phase/status markdown files (agent pass logs)
- 106 obsolete dated docs under `docs/` (build-fix notes, section audit duplicates, old release reviews)

Preserved:
- `README.md`
- Operator/release docs (migrations, Testnet gates, E2E, IDOR, economy stages)
- Product domain refs (`GH_*.md`, Pi identity)
- Recent social phases 1–4 + Phase 5 operator evidence + audit/harden notes
- `docs/architecture/*`
- `VERIFIED_MANIFEST.txt` / `VERCEL_DEPLOY.txt` when referenced by operator scripts

No application source, migrations, tests, or lockfiles were deleted.
