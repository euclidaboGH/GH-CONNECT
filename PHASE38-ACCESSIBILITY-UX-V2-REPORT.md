# GREENHAVEN — PHASE 38
## Accessibility + World-Class UX Consistency V2

### Objective
Converge GreenHaven's interaction and accessibility contract across the shell and shared overlays without changing business, payment, economy, privacy, or Pi authority rules.

### Major upgrades
- Mounted the existing skip-to-content control and added a stable, keyboard-focusable `ghc-main-content` target.
- Mounted the existing global keyboard shortcut layer so `/` search and `C` compose shortcuts are actually active in the application shell.
- Added a non-invasive live navigation announcer for major tab changes.
- Standardized global focus-visible treatment with a 3px theme-aware focus ring.
- Added a 44px touch-target contract for interactive controls, with an explicit compact opt-out class for genuinely dense controls.
- Added forced-colors support for high-contrast/Windows accessibility modes.
- Added a global reduced-motion contract for the app shell while preserving functional state changes.
- Added safe-area-aware sticky-footer treatment for mobile/Pi Browser surfaces.
- Improved narrow-screen text wrapping to reduce clipping in small WebViews.
- Added explicit accessible naming to the shared ActionSheet dialog.
- Added explicit accessible naming and description to ConfirmationDialog.
- Repaired accessible names for message actions, GreenHaven Identity QR/scan/find dialogs, and messaging tools.
- Added a static Phase 38 regression suite and wired it into CI verification.

### Verification
- Phase 38 accessibility/UX: 14/14
- Phase 37 performance/mobile: 18/18
- Phase 36 security/privacy/abuse: 19/19
- Phase 35 Pulse/media: 17/17
- Phase 34 reputation/curation: 18/18
- Phase 33 communities: 24/24
- Project integrity: 36/36, 0 errors, 0 warnings
- Clean migrations: 131
- Executable GreenHaven tables: 114
- Migration release readiness: PASS

### Runtime boundary
This phase was source/static verified. No live Next.js build, TypeScript compiler, browser E2E, live Supabase, Vercel deployment, or Pi Testnet execution is claimed because the source workspace does not contain the required installed runtime/deployment credentials.

### Remaining roadmap
39. Database + Backend Final Convergence
40. Automated Testing + Regression Fortress
41. Production Build + Vercel Repair
42. Pi Testnet E2E
43. Global Beta Readiness
44. Pi Ecosystem Compliance + Production Release Audit
