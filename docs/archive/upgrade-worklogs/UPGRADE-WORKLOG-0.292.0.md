# Upgrade Worklog — 0.292.0

## Phase 5 — Global experience localisation

Implemented a new typed experience-language catalog for feed, discovery and home greeting UI. Integrated selected-locale labels into feed filters, search, personalisation controls, offline/draft states, discovery categories/search/accessibility states and home greetings. Added regression checks and registered them in prebuild and static verification. Updated release metadata, source-of-truth documents and release manifest.

### Verification performed

- Global experience translation checks: 12/12 PASS.
- Global product translation checks: 12/12 PASS.
- Global i18n engine checks: 11/11 PASS.
- Consolidated static suite: recorded in delivery summary.
- Source-only verification was run. No Node 24.15.0 runtime claim is made where unavailable.

### Limitations

All Hausa, Igbo, Yoruba and Nigerian Pidgin translations remain preview/partial and require native-speaker and product-owner review. Untranslated strings fall back to English. Typecheck, lint, production build and browser E2E must be run under the required Node.js 24.15.0 runtime before production approval.
