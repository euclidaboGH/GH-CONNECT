# Upgrade worklog — 0.330.17

Date: 2026-11-07

Approved source artwork: `docs/brand-assets/greenhaven-official-logo-source.png` (SHA-256: `79611a974aaa32fcf588fea558946ff664e640d02d9e7052a4586744a6a9a2d0`).

## Official brand replacement

The owner-provided transparent GreenHaven logo artwork is now the authoritative application brand asset. The former GH Connect artwork has been replaced in the canonical public asset paths so all existing `BrandLogo` call sites receive the approved identity without scattered page-specific edits.

- Replaced the full hero/splash logo with the supplied complete lockup, including `CONNECT • GROW • IMPACT`.
- Derived transparent symbol-only and horizontal lockup crops directly from the supplied image; no logo geometry or lettering was redrawn.
- Added contrast-aware dark-surface variants that preserve the symbol and lift only the dark wordmark/tagline for legibility.
- Updated shared responsive logo sizing for hero, header, compact navigation and icon contexts.
- Rebuilt PWA, maskable, Apple touch and favicon PNG assets from the approved symbol on a quiet neutral background.
- Updated the service-worker public-static allowlist and cache version so clients do not keep serving the previous brand assets.
- Kept the GHC coin artwork separate and unchanged; it is a financial/product asset, not the GreenHaven brand mark.

## Verification and limits

- Updated the Phase 5 design-system asset contract to verify the owner-approved image hash and required responsive variants.
- Consolidated network/database-independent static verification passed **57/57**; the focused Phase 5 design-system contract passed **23/23**, project-truth contract **10/10**, Phase 30 reliability contract **13/13**, and Phase 31 shell contract **15/15**.
- Release metadata advanced to 0.330.17 and synchronized across package, lockfile, app release constant, README, project truth and verified manifest.
- No database migration, user data, authentication, Wallet, Rewards, Membership, payment, Pi or GHC ledger authority changed.
- This is a source-level branding and shell presentation increment. The full `prebuild` chain correctly stopped at its Node runtime guard because this environment provides Node.js 22.16.0 rather than the required Node.js 24.15.0 runtime. Typecheck, lint, production build, browser/Pi Browser/WebView and installed-PWA visual acceptance remain required. Production remains NOT APPROVED until the full external release gates pass.
