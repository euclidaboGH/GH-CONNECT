# GH-CONNECT Profile + Connected Systems Audit — Pass B

Date: 2026-10-14

## Source scope

Profile screen and Dashboard; peer-profile preview and content library; media upload/resolution; story APIs and composers; message/conversation APIs; settings navigation; Feed post actions; wallet, rewards, membership, curation and reputation APIs; release/authz static gates.

## New fixes in this pass

1. Centralized `ghc:open-profile` handling in the app shell and mounted the existing peer-profile component.
2. Wired peer-profile Follow, Message, Like/Pass, Block and Report to existing context actions, with visible failure feedback.
3. Removed the synthetic compatibility percentage from peer profiles to avoid presenting a fabricated ranking score as fact.
4. Made unsupported Mute actions disappear when no handler is supplied.
5. Passed profile-photo and cover-photo history into the peer profile's content library.
6. Changed the Posts tab to show the full timeline, including media-bearing posts.
7. Added rate limits to story list and create routes.
8. Bounded story request size and text length; validated media URLs and type.
9. Server-generated story IDs and session-derived story display name; durable read failures now return explicit errors.
10. Added no-store response helper to all media route responses and rate-limited media resolution.
11. Validated media-resolution identifiers and normalized resolver errors to avoid leaking upstream details.
12. Removed upstream storage error details from media-upload API responses.
13. Added the same 4 MB preflight guard to the alternate media pipeline to avoid predictable Vercel 413 failures.
14. Added conversation-create rate limits and request-size bounds; clamped list limits.
15. Added per-user rate limits to message reads, edits and deletes; validated conversation/message IDs and bounded edit bodies.
16. Added `npm run audit:profile-connected-v2` with 84 static checks.

## 50-item safe-upgrade baseline

The previous 50-item baseline remains included in the source archive and is documented in the prior audit report. It covers modal accessibility, cancellation/pagination, URL safety, cursor validation, SQL function hardening, upload signature validation, Vercel upload guards, durable story/video behavior, owner-post identity filtering, Feed action wiring, profile save handling, Dashboard navigation, and authenticated wallet/reward/membership/reputation/curation/messaging routes.

This pass adds the fixes above rather than reverting or duplicating the previous work.

## Verification run

- Profile audit: 87/87.
- Connected profile/media audit: 83/83.
- Connected systems v2 audit: 84/84.
- JSX safety: 613 files scanned.
- IDOR static checks: 124 pass, 0 fail across 112 API routes.
- Social authz static checks: 31 pass, 0 fail.
- Phase 14 static verification: 11/11.
- Production safety scan: 21 pass, 0 fail.
- Automated release suite: 30 pass, 0 fail; operator gates remain open.
- Changed TypeScript/TSX syntax transpilation: 8/8.

## Not certified yet

`node_modules` is absent/incomplete in this environment. `npm run typecheck` fails because framework/runtime/type packages such as `next`, `react`, `@types/node` and other dependencies cannot be resolved. Therefore ESLint and the Next.js production build have not been validated. Testnet migrations, live multi-user authorization, Pi Browser payment E2E, multi-instance concurrency and signed private-media delivery remain operator gates.

Large video/PDF uploads still require direct-to-storage/resumable upload support. Public storage URLs remain unsuitable for restricted intellectual property. Wallet and reward issuance logic were not changed.
