# GH-CONNECT v0.90.7 — Premium UI and Four-Phase Review

## Scope
A presentation-first upgrade to Feed, Profile, Wallet, Membership, and Rewards Centre, built on the v0.90.6 source archive. No payment, reward issuance, balance authority, membership entitlement, Pi authentication, or database authorization logic was moved into the client.

## Changes
- Feed: focused responsive reading column, calmer filter bar, stronger card boundaries, consistent hover/touch feedback, and scroll behavior suitable for mobile and desktop.
- Profile: improved cover treatment, identity hierarchy, avatar framing, readable social metrics, and consistent content surfaces while preserving real profile counts and edit/share actions.
- Wallet: clearer financial metric cards, stronger available-balance hero treatment, improved legibility for long numeric values, and retained separate Pi/GHC rails and authoritative refresh behavior.
- Membership: centered responsive content width, refined plan/status cards, clearer selected-state affordance, and preserved server-confirmed tier/entitlement status.
- Rewards: consistent mission surfaces and action feedback, accessible named region, and dark-mode-aware visual treatment while retaining server-driven claims and reward settlement.
- Shared quality: dark-theme support, reduced-motion handling, focus visibility, touch-sized controls, safe-area padding, and a static source-contract test.
- Release metadata: synchronized project version to 0.90.7.

## Validation
`check-phase25-premium-ui.mjs` verifies the expected section classes, accessible regions, and that presentation polish is layered over existing authoritative state. The full static suite should be run on Node.js 24.15.0 or compatible. Visual CSS changes cannot establish live payment or database correctness.

## Release gates not claimed as passed
- Full Next.js production build, TypeScript, and lint on the pinned supported runtime.
- Mobile and desktop browser visual QA, including Pi Browser/WebView and dark mode.
- Live Testnet verification of daily reward maturity, concurrent claims, Pi/GHC marketplace checkout, and community fee/create recovery.
- Resolve the documented non-atomic community fee settlement versus durable creation failure case before real-value activation.
