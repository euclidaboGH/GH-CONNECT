# Upgrade worklog — 0.338.10

Date: 2026-11-09  
Baseline: 0.338.9  
Focus: Messaging and Community responsiveness, discoverability, and failure handling.

## Delivered

- Bounded auto-growing message composer.
- Escape dismissal for emoji picker.
- In-thread recent-message search with accessible focus, count, empty state, and scoped behavior disclosure.
- Escape closes search before the conversation.
- Explicit offline failure result for community joins.
- Offline guards and stable error handling for invitation acceptance and decline.
- Stable transport failure handling for community leave.
- Three independent static regression gates, wired into prebuild and static verification.

## Validation

- Priority 8 messaging: 49/49.
- Massive messaging contract: 10/10.
- Priority 7 community: 13/13.
- Marketplace/community security: 42/42.
- UI/navigation/responsive: 31/31.
- New composer: 8/8.
- New message search: 10/10.
- New community resilience: 9/9.
- Repository consistency: 6/6.

Typecheck, lint, and production build were not run to completion. Current execution runtime is Node 22.16.0, but the project requires Node 24.15.0; `npm ci --legacy-peer-deps` timed out before the required executables were available.
