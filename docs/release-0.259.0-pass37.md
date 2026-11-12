> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.259.0 — Pass 37: Architecture Decomposition

## Scope
- Extracted durable API feed-row normalization from the oversized GHC context into `lib/social/map-remote-feed-posts.ts`.
- Extracted marketplace listing presentation and related-discovery helpers from the Marketplace screen into `lib/marketplace/discovery-presentation.ts`.
- Kept the provider responsible for orchestration and the screen responsible for rendering/workflow composition.
- No database migrations or financial execution paths changed.

## Boundaries
- Feed normalization retains existing field aliases, visibility defaults, engagement normalization, and invalid-ID filtering.
- Marketplace discovery still derives suggestions only from actual marketplace listings and communities.
- Payment, wallet, membership, ledger, and authorization code was not modified.

## Architecture measurements
- `contexts/ghc-context.tsx`: remains a large provider and is still a priority for staged decomposition; feed API normalization was moved out first to establish a safe extraction pattern.
- `components/ghc/marketplace-screen.tsx`: listing price/date formatting, related-search tokenization, related-listing ranking, and community suggestion ranking were moved into a dedicated module.
- These extractions reduce domain/presentation coupling but do not yet complete the larger provider/screen split.

## Verification limits
Static source checks do not prove live Supabase RLS, deployed grants, Pi payment completion, or production end-to-end behavior. Full build/typecheck requires Node 24.15.0.

Canonical navigation remains Home · Messages · Communities · Cart · Profile; Wallet remains an overlay.
