# GH-CONNECT v0.62.1 — Phase 21 premium product polish

## Product/UI improvements

- Added a cross-product design-system refinement layer for the feed, discovery, profile, wallet, marketplace, messages, communities, composer, dialogs and shared navigation.
- Standardized light/dark surface tokens and refined violet, ocean and sunset preset surfaces without removing the existing theme registry or custom wallpaper support.
- Improved shared focus-visible feedback, form-control focus states, reduced-motion handling, responsive feed widths, safe-area-aware navigation, and card/header depth.
- Restyled the route-level error recovery screen with clearer copy, consistent actions, accessible status semantics and a premium GreenHaven surface.
- Restored user zoom support by removing the restrictive mobile viewport scale cap.
- Added a 14-check Phase 21 source regression suite and integrated it into `ci:verify`.

## Engineering safeguards retained

- No existing user data, ledger rows, account identities, Pi auth flow, payment gates or payout feature flags were migrated or rewritten in this phase.
- No Supabase migrations were added or applied in Phase 21.
- Pi A2U and GHC seller payout remain gated as documented in the Phase 20 release notes. Bank payout remains disabled pending a selected provider and verified beneficiary/reconciliation rail.

## Verification status

- Phase 21 premium UI checks: 14/14 passed.
- Release hygiene, migration inventory synchronization, production safety scan, Phase 20 payout source checks and Phase 19 financial/media checks passed in this workspace.
- `npm install --package-lock-only --legacy-peer-deps` could not complete because registry access timed out. The `pi-backend` transitive dependency graph is therefore still missing from `package-lock.json`; a clean `npm ci`, TypeScript check, ESLint run and production build remain unverified and this archive is not cleared for production deployment.
- No live Supabase migration, Pi Testnet payment, payout settlement, GitHub push or Vercel deployment was performed.
