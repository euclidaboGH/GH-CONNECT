> HISTORICAL RECORD — not current release status. Check `docs/PROJECT_TRUTH.md` and current CI evidence before relying on this report.

---

# Stabilization Phases 1–2 — Revisit and Implementation

**Source baseline:** GH-CONNECT `0.63.25`  
**Review date:** 2026-10-21  
**Scope:** build/dependency stability and source/documentation truth.  
**External effects:** no database, Supabase project, Pi provider, Vercel deployment, or production account was accessed or changed.

## Phase 1 — Build and dependency stability

- Added supported-Node preflights to direct `typecheck`, `lint`, and `build` entry points so local commands cannot silently use an unsupported runtime. The build preflight retains the existing JSX safety scan.
- Kept `.nvmrc`, `package.json` engine range, and CI Node 24.15.0 aligned.
- Removed a duplicate runtime check from the Preview/Testnet workflow and added runtime plus dependency-lock preflights to the production smoke workflow.
- Added a focused regression contract for runtime wiring, lock/version consistency, CI behavior, migration inventory synchronization, and current release truth.
- Verified the official `pi-backend@0.1.3` lock entries with the repository's dedicated lock verifier; corrected current README claims that said the SDK graph was still missing.

## Phase 2 — Project truth and documentation

- Reconciled current canonical migration count from **107 to 109** and classification from **77 REQUIRED / 1 REQUIRES_APPROVAL / 2 PROPOSAL / 27 REVIEW_REQUIRED** to **77 / 1 / 2 / 29** in the current project-truth, phase-status, Testnet gate, README and engineering records.
- Repaired a regression contract that hard-coded the obsolete 107-migration count.
- Preserved dated reports as historical snapshots rather than rewriting them to imply their old checks ran against today's tree.
- Kept the core safety rule explicit: migration inventory is not remote application evidence, and migration classes do not authorize blind `supabase db push`.

## Verification evidence

- Phase 1–2 foundation contract: **18/18 passed**.
- Project-truth consistency: **14/14 passed**.
- Phase 1 release-readiness contract: **13/13 passed**.
- Stabilization Phase 3 security/migration regression: **25/25 passed**.
- Official Pi SDK lock verifier: **passed**.
- Dependency lock coverage/root version: **passed**.
- Generated migration inventory check: **passed** after synchronization.

These are source/static checks. The available runtime in this workspace is Node `22.16.0`, below the supported minimum. The supported-runtime preflight is tested using version fixtures, but a clean install, TypeScript, ESLint, production build, browser E2E, PostgreSQL execution, live Testnet, and provider flows are **not verified** here. Do not mark them passed.

## Required remaining gate

On a registry-connected runner with Node `24.15.0`, run:

```bash
npm run check:runtime
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm run test:safety
npm run ci:verify
npm run build
```

Capture the actual commit and complete command logs. Then validate SQL against disposable PostgreSQL and perform the separate Testnet/operator gates. No Mainnet release approval is implied by this source pass.
