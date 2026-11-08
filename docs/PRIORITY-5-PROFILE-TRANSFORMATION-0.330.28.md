# Priority 5 — Profile transformation (0.330.28)

Date: 2026-11-07

## Product audit findings

The existing Profile surface already contained a substantial owner dashboard, durable profile timeline, media library, professional/business identity editor, achievements, follow graph and privacy-projected public profile API. The gap was integration: the public profile API returned professional/business fields, but the app's peer-profile hydration discarded them before rendering. Cached discovery candidates also bypassed canonical public-profile enrichment. Profile sharing pointed to the generic app root without a resolvable profile identifier. Owner portfolio and achievements were hidden in the dashboard instead of being available in the visible About section. Some counts fell back to local arrays or zero while authoritative data was still loading.

## Delivered changes

1. Public peer profiles retain the privacy-projected `profileMode`, `professional`, `business` and `skills` fields from `/api/social/profile/:userId`, enabling the existing professional/business showcase and selected-work portfolio in the public profile preview.
2. Real cached discovery candidates render immediately, then hydrate from the canonical public profile endpoint. Sample/demo profiles remain local. A monotonically increasing request token prevents an older profile response from replacing a more recently opened profile.
3. Profile sharing now uses `/?profile=<userId>`. The app validates the identifier, dispatches the canonical `ghc:open-profile` event after shell listeners mount, and removes the consumed query parameter while preserving unrelated referral/query data.
4. The owner About section now presents the professional/business identity showcase and durable achievement showcase, rather than hiding these capabilities only in the private dashboard.
5. The owner profile displays the authoritative identity snapshot on the main profile surface. Follower/following counts remain unknown until the API returns them; posts show a loaded count with a plus marker when older pages remain rather than claiming the loaded page is the lifetime total.
6. Profile section tabs expose stable IDs, selected tab focus and ARIA control relationships.
7. Added a Priority 5 regression gate and aligned release metadata/documentation at 0.330.28.

## Security and data boundaries

- Public identity is sourced from the server's privacy-projected profile endpoint. Existing server projection continues to enforce profile visibility and hide private wallet, balance, membership and internal verification fields.
- No profile privacy defaults were broadened. No new public fields or server authority were introduced.
- Portfolio URLs remain HTTPS-only and are rendered with `noopener noreferrer` and no referrer.
- No migrations, financial operations or entitlement changes were made.

## Verification

The dedicated Priority 5 source regression gate checks canonical profile hydration, stale-response fencing, share deep links, owner portfolio visibility, authoritative metrics, tab semantics and privacy projection. Existing profile, privacy, media, identity and social-story source checks are also retained.

Node 22.16.0 is available in this environment while the repository requires Node 24.15.0. Dependency-backed typecheck, lint and production build remain unverified. Browser, Android/WebView, Pi Browser and live Testnet acceptance remain outstanding. Production is NOT APPROVED.
