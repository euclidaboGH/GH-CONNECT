# GreenHaven upgrade worklog — 0.312.0

## Phase 27 — Scroll immersion and creator analytics

### Implemented
- Fixed bottom-navigation scroll detection to resolve the actual nested scrolling element. The previous handler relied on `currentTarget`, which was frequently the non-scrolling tab wrapper and therefore read a constant `scrollTop` of zero.
- Preserved the intended gesture: upward content movement hides navigation; downward content movement restores it.
- Collapsed the in-flow navigation height, flex basis, padding and border when hidden; reduced the feed's reserved bottom inset so content reclaims the available viewport.
- Replaced the inline expanding curation accordion with a responsive, accessible modal sheet rendered outside the clipped post card.
- Analytics are now loaded on demand rather than issuing two requests for every post card at feed mount. Added a 10-second request abort, cancellation on close/unmount, latest-request-wins sequencing, Escape handling, focus trapping/restoration and body-scroll restoration.
- Preserved server-authoritative reward data and explicit no-vote-mints-GHC messaging.

### Financial and database boundary
- No migration added or applied.
- No GHC, Pi, wallet, treasury, settlement, curation score or ledger mutation authority changed.

### Verification boundary
- Phase 27 static regression gate is included in `prebuild` and `verify:static`.
- Full typecheck, lint, production build, browser/device behavior and live backend verification require the pinned Node 24.15.0 runtime and connected deployment environment.

## Verification limitation
- This release includes source-only verification and isolated helper tests. The available environment must use Node.js 24.15.0 before dependency installation, TypeScript, ESLint and production build can be certified. Live database/provider and device acceptance are not implied by static checks.
