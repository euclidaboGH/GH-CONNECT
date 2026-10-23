# GreenHaven Phase 13 — Massive Social Integration Upgrade

## Scope

This phase fixes the cross-screen social lifecycle rather than treating Profile, Feed and Comments as isolated UI surfaces.

### 1. Global composer architecture
- The canonical `PostComposer` is now mounted by the App shell.
- `ghc:open-compose` is handled even when Home/Feed is unmounted.
- Profile → Create → Post now reaches the same durable Unified Composer as Home.
- Duplicate Feed-local composer ownership was removed.
- Global close events close the composer consistently during navigation.

### 2. Profile → post routing
- Profile post actions now survive the transition to Home.
- The App shell changes tabs first, then replays the requested post action after Feed mounts.
- A dedicated `ghc:open-post-ready` event prevents recursive routing.

### 3. Deep post hydration
- Feed no longer assumes a post must already be present in the current feed page.
- Added `GET /api/social/posts/[id]` as a server-authoritative single-post read.
- Visibility is rechecked server-side before returning the post.
- Older Profile posts can now be hydrated directly and opened for comment/share/insights.
- A routed post is retained for the Comment/Detail overlay while the Feed catches up.

### 4. Comment reliability
- Profile-originated comments use the same durable comment API as Feed-originated comments.
- The comments surface can now operate on a directly hydrated routed post.
- Existing server-side post visibility remains fail-closed.

## Verification

- Phase 13 profile/social routing contract: 11/11
- Clean migration inventory: 116/116
- Database source contract: 100 executable tables / 116 migrations
- Phase 5 database tooling: PASS
- Phase 7 product experience: 27/27

## Runtime limitation

This package was not falsely declared TypeScript/ESLint/Next.js-build clean because the working environment does not contain the project's installed dependency tree. Those checks remain required in the project's Node 24/Vercel environment.
