# 0.143.0 — Hooks fix + section upgrades

## Build fixes
- `communities-screen.tsx`: moved `visibilitychange` `useEffect` above conditional selected-community return (rules-of-hooks).
- `message-screen.tsx`: moved `ghc:prefetch-tab` `useEffect` to top of component (rules-of-hooks).

## Extra stability
- Online event soft-revalidate for feed, messages, discover, marketplace, communities.
- Header banner id for skip/accessibility.
- Inbox row content-visibility CSS.
