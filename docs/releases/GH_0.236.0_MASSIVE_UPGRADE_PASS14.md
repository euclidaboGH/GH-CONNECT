> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.236.0 — Massive Upgrade Pass 14

## Product Design System & Results-Oriented UX

This pass strengthens GreenHaven as one coherent premium product rather than a collection of independently styled features. It introduces reusable section hierarchy, calmer premium page chrome, shared raised-surface tokens, pointer-aware interaction feedback, and reduced-motion-safe result cards.

### Changes
- Added a reusable `SectionHeading` primitive for consistent eyebrow/title/description hierarchy.
- Upgraded Home result cards to the shared premium surface language.
- Refined shared `PageChrome` for stronger mobile tap targets, typography and translucent platform chrome.
- Added product-level radius, border, surface and elevation tokens.
- Added hover behavior only for devices with true hover capability, avoiding accidental mobile behavior.
- Preserved reduced-motion accessibility.
- Preserved the canonical bottom navigation: Home · Messages · Communities · Cart · Profile.
- Wallet remains an overlay.
- No Supabase migration changes.

### Verification
Use `node scripts/check-pass14-product-design.mjs` for the focused source gate. Full production build still requires the repository's required Node 24.15+ runtime.
