# GreenHaven v0.157.5 — Phase 6 navigation hardening

**Baseline:** `GREENHAVEN-0.157.4-PHASE5-BRAND-SAFE-DESIGN-SYSTEM-2026-10-28.zip`  
**Scope:** Application shell, navigation payload integrity, and unknown-route recovery.  
**Change type:** Source-only; no database migration or live environment changes.

## Implemented

- `navigateTo` now explicitly returns `false` outside a browser runtime. It cannot report success or attempt delayed browser work during server-side invocation.
- Navigation string inputs reject ASCII control characters as well as oversized values.
- Settings destinations use a runtime allowlist rather than relying only on TypeScript types, so unexpected runtime payloads cannot select arbitrary settings sections.
- The not-found page's explicit “Go back” action checks browser history availability and routes to `/` when there is no prior entry, avoiding a dead-end on direct-entry 404s.
- Phase 6 static contracts now assert the browser-runtime guard, settings allowlist, control-character validation, and not-found fallback.
- Package, lockfile root, app release constant, manifest, project-truth documentation, and consolidated acceptance report advanced to `0.157.5`.

## Preserved

- Canonical destination catalogue and aliases.
- Existing five-item bottom navigation and overlay event contracts.
- Official GreenHaven and GHC brand assets unchanged.
- Authentication, onboarding authority, session-lock provider lifetime, wallet/payment logic, database schema, and migrations unchanged.

## Verification boundaries

Run the Phase 6 contract check and consolidated static suite in the archive. These source checks do not establish a supported-runtime build, browser journey acceptance, screen-reader behavior, or live provider/database readiness. Node.js 24.15.0 and dependencies are required for the full TypeScript/lint/build checks; operational checks remain separately gated.
