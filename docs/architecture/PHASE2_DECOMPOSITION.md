# Phase 2A/2B — Structural + product navigation

## Stage 2A delivered
- Typed mutation contracts (`lib/contracts/mutations.ts`)
- Marketplace authority (`lib/contracts/marketplace-authority.ts`, checkout gate)
- Client-safe API errors (`lib/client/safe-api-error.ts` → `lib/api.ts`)
- Wallet domain provider (read-only financial boundary)
- Wallet/marketplace section shells under `features/*/sections`
- Existing ghc-context domain slices retained (shell/profile/discovery/messaging/feed)

## Stage 2B delivered (partial)
- Bottom nav retargeted: **Home · Cart · Wallet · Profile**
- Cart → marketplace overlay; Wallet → wallet overlay
- Discover/Messages remain via deep-links and secondary entry points

## Not fully complete (honest)
- Full line-by-line split of 8542-line `ghc-context.tsx` into separate packages
- Full visual redesign of every screen to “world-class” fidelity
- Live Playwright execution (specs added; run BLOCKED without browser+credentials)

## Financial invariants preserved
PI ≠ GHC · request ≠ paid · client ≠ settlement · Mainnet off · memory ledger blocked
