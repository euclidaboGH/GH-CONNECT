# GH-CONNECT Profile + Connected Systems — Deep Audit

**Date:** 2026-10-14  
**Source:** `GH-CONNECT-Profile-Media-Library-2026-10-14.zip`  
**Purpose:** improve the profile/content-library UX and add safety gates around connected post, messaging, story, settings, rewards, membership, curation, ranking, reputation and wallet surfaces.  
**Status:** static gates pass; full production certification is not claimed.

## 50-item safe upgrade ledger

### Implemented in this pass (1–30)

1. Added keyboard focus placement when the Profile Content Library opens.
2. Added a keyboard focus trap to the library dialog.
3. Restored focus to the invoking control when the dialog closes.
4. Locked background body scrolling while the modal is open.
5. Kept Escape dismissal available without re-registering the handler on every parent render.
6. Associated the dialog with its visible title using `aria-labelledby`.
7. Cancelled obsolete search/page fetches with `AbortController`.
8. Cancelled obsolete load-more fetches when profile, filter, or query changes.
9. Deduplicated paginated results by stable post ID.
10. Replaced a regex-only external URL check with URL parsing.
11. Restricted external media URLs to HTTPS with a valid host.
12. Rejected URLs containing embedded username/password credentials.
13. Added size ceilings for inline image/video data URLs shown in the library.
14. Added `no-referrer` to remote image/video requests from the library.
15. Added `noopener noreferrer` and `no-referrer` to external PDF-open links.
16. Made malformed pagination cursors return HTTP 400 rather than silently restarting the first page.
17. Rejected non-safe-integer and non-positive timestamp cursors.
18. Added `Cache-Control: no-store` to content API authentication/validation errors.
19. Hardened the profile-content SQL function search path to `pg_catalog, public, pg_temp`.
20. Added an additive active-post author/timestamp/ID cursor index for profile-library pagination.
21. Replaced broad media-kind sniffing with concrete MIME signature inference.
22. Rejected files whose signature is not a supported image, video or PDF.
23. Rejected allowed MIME types that disagree with detected file contents.
24. Prevented arbitrary ISO-BMFF `ftyp` files (including AVIF images) from being classified as MP4 by default.
25. Added a request content-length guard before multipart parsing.
26. Added a client-side 4 MB fail-fast ceiling for the current Vercel function proxy upload path.
27. Added an explicit user-facing message that large-file direct upload is not enabled yet.
28. Removed `blob:` video URL fallbacks from the unified composer so non-durable browser-local URLs cannot be published.
29. Restricted the story-image inline fallback to small payloads only.
30. Routed the older Profile Story composer through the durable upload helper and removed its `blob:` URL publishing path.

### Existing controls verified and regression-guarded (31–50)

31. Profile timeline filters posts to the active owner's identity.
32. Author ID takes precedence over display-name fallback for ownership.
33. Owner timeline uses the canonical enhanced post card.
34. Owner post cards retain like, edit, delete, archive and save handlers.
35. Profile comment/share/insights actions are routed to the Feed's existing overlays.
36. Profile edits await persistence and report success/failure.
37. Edit modal prevents duplicate saves and avoids closing on Escape while saving.
38. Profile Dashboard is distinct and collapsed by default.
39. Rewards navigation remains available in Dashboard.
40. Membership navigation remains available in Dashboard.
41. Profile settings and wallet quick actions remain available.
42. Wallet API authenticates the caller and enforces same-user access.
43. Profile API authenticates the caller.
44. Profile API strips client-controlled balance/membership fields.
45. Rewards claim route authenticates the caller.
46. Daily rewards route authenticates the caller.
47. Membership status route authenticates the caller.
48. Reputation API authenticates and rate-limits requests.
49. Curation API authenticates and rate-limits requests.
50. Messaging and story API routes remain authenticated; existing release/IDOR/JSX gates remain wired into package scripts.

## Audit commands

```bash
npm run audit:profile
npm run audit:profile-connected
npm run check:jsx
npm run test:idor-static
npm run test:social-authz
npm run verify:static
npm run test:safety
npm run test:release
```

The new `audit:profile-connected` script adds a dedicated regression gate for the changed profile/media behavior and the critical auth/wiring surfaces. It is a static source check, not a substitute for runtime tests.

## Critical release gates

- **Large uploads on Vercel:** Vercel Functions have a 4.5 MB request/response body limit. The client now fails fast above 4 MB on the current proxy path; direct-to-storage signed/resumable upload must be implemented before enabling large video/PDF uploads. See `docs/GH_PROFILE_CONTENT_LIBRARY.md`.
- **Private media:** current storage URL generation is public-object based. Visibility-filtered post queries do not revoke already-public URLs. Do not store restricted intellectual property until private storage and signed delivery are enforced across posts, stories, profile photos and messages.
- **Database:** apply the profile content migration on Testnet, then verify function privileges and visibility as owner, follower, accepted connection, unrelated viewer and blocked viewer.
- **Build:** run dependency installation, typecheck, lint and Next.js build in CI/local; static syntax and source checks are not equivalent to a production build.
- **Cross-system smoke tests:** validate messaging, stories, rewards, membership, curation, ranking/reputation and wallet in Testnet. Do not change wallet/reward rules in a profile release.

## Verification notes

The source includes static gates for profile production audit, JSX safety, IDOR, social auth, Phase 14 and production release. Full dependency installation and full TypeScript/ESLint/Next.js build were not completed in this environment. No claim is made that the database migration has been applied to Testnet or that multi-user runtime authorization has been proven.
