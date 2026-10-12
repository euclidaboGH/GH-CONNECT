# Ecosystem & Marketplace discoverability (2026-10-12)

## Problem
Marketplace and other GreenHaven services were only reachable through obscure paths (events / deep links), so most users never found them.

## Changes (navigation only — no invented catalog/commerce)
1. **Home feed header** — Marketplace + Ecosystem icon buttons
2. **Home feed body** — compact `EcosystemQuickAccess` card
3. **Profile → More** — dedicated **Marketplace & Ecosystem** grid
4. **Profile ecosystem hub** — Marketplace + Full ecosystem tiles
5. Shared component `components/ghc/ecosystem-quick-access.tsx` uses existing `navigateTo("marketplace"|"ecosystem")`

## Operator note
Listing content still comes from existing marketplace domain/API — empty states remain honest when no listings exist.
