# GH-CONNECT 0.62.5 — Phase 25 repository cleanup

- Added a read-only repository integrity audit and wired it into CI/`ci:verify`.
- Removed duplicate deployment-wide security headers from Next config; Vercel now owns the global CSP and related security headers.
- Hardened Git exclusions and removed generated TypeScript incremental state.
- Kept release metadata and source-level regression tests version-aligned without hard-coded phase versions.
- All 129 repository source-regression scripts pass; project audit checks pass 27/27 with the incomplete SDK lock reported as a warning.
- Retained historical project/audit documentation for traceability.

**Release status: NOT CLEARED FOR DEPLOYMENT.** `package-lock.json` still lacks the real dependency graph for `pi-backend@0.1.3`; npm registry access in this environment is unavailable. Clean install, typecheck, lint, full CI, production build, live Pi Testnet, Supabase and Paystack verification, and real browser screenshot review remain outstanding. See `PHASE_25_REPOSITORY_CLEANUP_AND_DEPLOYMENT_READINESS_2026-10-19.md` and `RELEASE_GATE_PHASE25.md`.
