# Upgrade Worklog — 0.298.0

## Phase 12 — global locale integration and release guardrails

- Preserved explicit locale choices in memory when localStorage is blocked or unavailable.
- Kept persisted locale choices in the in-session fallback across later regional-context refreshes.
- Synchronized cross-tab preference updates and made reset pin browser-language fallback for the session, even when storage removal fails.
- Added defensive fallback behavior for locale-aware unit and plural formatting.
- Added `check:global-locale-integration-phase12` to prebuild and static verification.
- Kept preview translations pending native review and preserved the no-auto-translation and financial-display-only boundaries.

## Verification boundary

The Phase 12 source-only contract is static evidence, not browser execution. The available environment uses Node.js 22.16.0 while the project requires Node.js 24.15.0; TypeScript, lint and production build must be rerun under the supported runtime with dependencies installed from the lockfile. No remote service, database, migration, payment or wallet operation was performed. Production remains NOT APPROVED.
