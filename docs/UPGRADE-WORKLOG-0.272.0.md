# Upgrade worklog — 0.272.0

## Cross-section wiring & soft-refresh pass

### Soft refresh / auto-update
1. Profile posts timeline soft-refresh via `useSectionRefresh("profile")` + tick re-fetch.
2. Discover grid soft-refresh (`refreshCandidates` / event).
3. Matches soft-refresh event.
4. Soft-refresh default interval reduced 12s → 8s for focus/visibility.
5. Post-login multi-section emit retained from 0.271.5+.
6. Feed / messages / communities / marketplace / notifications already section-refresh wired.

### Wallet / rewards / Pi
7. Rewards centre embeds `PiPayoutAuthorizationCard` above earnings dashboard.
8. Authorize-first withdraw panel + dual `active`/`authorizationActive` fields (0.271.6).
9. Humanized payout errors (no raw WALLET_AUTHORIZATION_REQUIRED).
10. Settings `pi-payout-auth` section retained.

### Feed / profile cards / stories
11. Post engagement CSS grid (quality · up · down · spacer · comment · save · share).
12. Pass 16 response actions `aria-label="Comment"` restored.
13. Stories single + badge (no dual plus).
14. Feed composer + stories rail on Home.

### Shell
15. Toast host remains above bottom nav inset.
16. Cart badge via `ghc:marketplace-cart-changed`.
17. Canonical bottom nav contract preserved in destinations.

Source-level / source-only verification only. Supported runtime: Node.js 24.15.0.
Document date: 2026-11-01.
