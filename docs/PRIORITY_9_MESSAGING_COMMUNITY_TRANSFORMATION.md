# Priority 9 — Messaging and Community Transformation

Release: `0.338.10`  
Baseline: `0.338.9`  
Scope: responsive messaging UX, in-thread discovery, community action resilience.

## Source and safety boundaries

- This release is based only on `GREENHAVEN-0.338.9-RESPONSIVE-UI-MARKETPLACE-COMMUNITY.zip`.
- No SQL migrations, database schema changes, new privileged RPCs, payment changes, or authorization relaxations were introduced.
- Existing durable messaging membership checks, session-derived identity, owner-validated media, idempotency, and fail-closed rate limits remain in place.
- Community membership state is still updated locally only after the authoritative action succeeds.
- The Facebook reference video was not present in the received conversation files during this implementation increment. Video-specific observations are therefore not claimed or inferred.

## Implemented in 0.338.10

1. Message composer grows with multi-line drafts up to a bounded 120px height.
2. Long composer content scrolls internally instead of expanding the thread indefinitely.
3. Composer sizing recalculates as the draft changes.
4. Escape closes the emoji picker without submitting the message.
5. Existing 8,000-character limit is preserved.
6. Existing Enter-to-send and Shift+Enter newline behavior is preserved.
7. Existing double-submit protection is preserved.
8. Conversation header exposes an accessible recent-message search action.
9. Recent-message search is available inside the active thread.
10. Search is explicitly scoped to messages currently loaded in the thread; it does not claim full-history/server search.
11. Search input is bounded to 120 characters.
12. Search input receives focus when opened.
13. Search result count is announced to assistive technology.
14. Empty search results have a distinct explanatory state.
15. Search state clears when a thread closes or changes.
16. Escape closes the search panel before it closes the conversation.
17. Offline community join returns an explicit `false` result rather than `undefined`.
18. Offline invitation acceptance is stopped before a network mutation is attempted.
19. Offline invitation decline is stopped before a network mutation is attempted.
20. Invitation acceptance transport failures are caught and surfaced as a stable user-facing error.
21. Invitation decline transport failures are caught and surfaced as a stable user-facing error.
22. Rejected invitation actions produce an explicit user-facing error.
23. Community leave transport failures are caught and do not mutate local membership state.
24. Existing local membership cache changes remain gated on successful leave.

The above are implementation changes and regression assertions, not claims of live-device or backend E2E verification.

## Regression gates added

- `scripts/check-priority9-messaging-composer.mjs` — 8 assertions.
- `scripts/check-priority9-message-search.mjs` — 10 assertions.
- `scripts/check-priority9-community-action-resilience.mjs` — 9 assertions.

All three are registered in `prebuild` and `verify:static`.

## Existing gates rerun

- Priority 8 messaging transformation: 49/49 PASS.
- Massive messaging upgrade contract: 10/10 PASS.
- Priority 7 community transformation: 13/13 PASS.
- Independent marketplace/community security audit: 42/42 PASS.
- UI/navigation/responsive audit: 31/31 PASS.
- New composer gate: 8/8 PASS.
- New recent-message search gate: 10/10 PASS.
- New community action resilience gate: 9/9 PASS.

## Verification still required

Dependency installation did not complete in the execution environment. The environment runs Node `22.16.0`, while this repository pins Node `24.15.0` in `.nvmrc` and `package.json`; `npm ci --legacy-peer-deps` timed out before TypeScript and Next.js executables were installed. Therefore typecheck, lint, production build, browser/device checks, live realtime behavior, and Testnet integration remain unverified here.

## Next implementation tranche

Continue the 30+ upgrade programme after inspecting the Facebook reference video and completing the baseline runtime setup. Candidate work includes server-indexed full-history search, richer group administration, shared-media views, message request controls, accessibility refinements, community announcement/event flows, member discovery, moderation tooling, and realtime/offline reliability. Each item must be checked against existing APIs and durable authority before implementation; no feature should be represented as live unless its backend contract exists and is verified.
