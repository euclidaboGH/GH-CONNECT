# GH-CONNECT — Phase 2 Closeout / Phase 3 Creator & Media Start

**Source baseline:** `gh-connect@0.338.67` from the supplied Phase 2 social-engagement archive.  
**Change style:** additive, coordinated, non-destructive. No database migration, financial authority change, Pi payment behavior change, or deployment is included.

## Phase 2 — Social engagement closeout increment

### Cross-surface engagement reconciliation

- Community canonical post cards now publish server-returned reaction totals, reaction-kind counts, viewer reaction state, and bookmark state through the shared `ghc:post-engagement` event contract.
- Community cards subscribe to authoritative engagement updates so a known server count can refresh without a full remount.
- Successful comment deletion broadcasts the returned durable comment count to the shared post state and other subscribed surfaces.
- Existing share-sheet behavior continues to require a server-confirmed durable share before reporting the internal share action as complete and broadcasts the returned share count when supplied.
- No client-generated counts or reward credits are treated as authoritative.

### Notifications and deep links

- Durable comment/reply notifications retain the exact post, comment, parent, thread-root and listing context.
- Mention notifications now carry the same parent/thread deep-link context so a mention in a reply can return to the relevant conversation.
- The existing centralized notification target sanitizer and shell relay remain the routing authority; target IDs are routing hints and sensitive content is reloaded through authenticated domain APIs.

### Account-switch isolation

- Social GET coalescing keys now include a non-secret account identity scope, preventing identical paths for different users from sharing one in-flight response.
- A social response is rejected with `AUTH_CONTEXT_CHANGED` when the active account changes before it completes. This intentionally fails closed rather than applying an old account's response to the new account UI.
- The unified composer clears transient post/story text and media when identity changes, closes the composer, increments a generation guard, and ignores stale upload/publish completions.
- Saved collections and creator drafts retain their existing account-scoped storage boundaries.

### Phase 2 tests added

- `scripts/check-phase2-account-switch-engagement.mjs`
- `scripts/test-phase2-account-switch-engagement.mjs`

These cover account-specific in-flight reads, token-safe identity keys, stale responses after account switch/logout, community reaction/save broadcasts, comment deletion count propagation, and notification routing context.

## Phase 3 — Creator and media hardening started

- Media upload feedback now uses an explicitly indeterminate accessible progress indicator; it does not imply a false percentage when the upload API only provides status labels.
- The indicator respects `prefers-reduced-motion`.
- Failed document uploads no longer attach a local `data:` URL and claim that the file is ready when the publish path requires a durable server asset.
- Account-switch generation guards prevent late image/video/document upload completions from attaching media to a different account's composer.
- Existing single `UnifiedCompose`, durable media upload/finalization, media ownership validation, stable publish request IDs, account-scoped drafts, and durable URL checks are retained.

Phase 3 source gate: `scripts/check-phase3-creator-media-hardening.mjs`.

## Focused verification

The source-level checks passed in this working copy:

- Phase 2 account/count/notification hardening: 13/13
- Phase 2 account-switch runtime contract: 7/7
- Phase 2 social engagement hardening: 11/11
- Phase 1 unified post architecture: 14/14
- Run #289 notification source gates: 37/37
- Run #289 notification target tests: 20/20
- Phase 3 creator/media source gate: 13/13

These are focused source-contract and helper tests, not a substitute for browser E2E or a production build.

## Release verification blockers

- The environment currently exposes Node `v22.16.0`; the repository requires Node `^24.15.0`.
- A request to obtain Node `24.15.0` via npm timed out; this environment has no installed `node_modules` directory.
- Full TypeScript, ESLint and production build verification therefore remain unconfirmed.
- Browser/device visual review, two-account live acceptance, Testnet checks, and a deployment were not performed.

## Safety boundaries

No migration was applied. No Pi wallet, GHC ledger, reward issuance, withdrawal settlement, or blockchain authorization logic was changed. No GitHub push or Vercel deployment was performed. Do not release until the supported Node runtime, dependency install, complete checks, browser tests, and live environment-specific acceptance are available.
