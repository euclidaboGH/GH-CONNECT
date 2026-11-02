> Engineering note — 2026-11-02

# Phase 9 continuation 3: truthful navigation announcements and mobile resilience

## Changes

- Updated the shared shell announcer to say a navigation section was **selected**, rather than claiming the section had **loaded**. Selecting a tab does not prove that network-backed content has finished loading.
- Sanitized dynamic section labels by replacing control characters and bounding the spoken label to 80 characters.
- Preserved polite, atomic announcements and did not move focus automatically.
- Added a dedicated seven-assertion checker for announcement truthfulness and bounds, zoomable viewport configuration, dynamic viewport sizing, main-landmark focusability, and bottom safe-area padding.
- Registered the checker in both `prebuild` and `verify:static` so the contract is continuously checked.

## Safety boundaries

- No authentication, authorization, identity, database, wallet, financial, payment, or migration logic was changed.
- The announcement indicates navigation selection only; it does not claim that data loaded or a server action succeeded.
- No dependency versions or runtime requirements were changed.

## Verification

- `node scripts/check-roadmap-phase9-continuation3.mjs`: **7/7 passed**.
- Full `npm run verify:static`: to be recorded after execution for this continuation.
- Browser-based keyboard/screen-reader checks and Pi Browser/Supabase integration remain unverified in this environment.
- The repository requires Node 24.15.0; the available runtime is Node 22.16.0. Do not treat static checks under the available runtime as a production build result.

## Next items

1. Add browser-driven keyboard-only checks for focus order and modal close/restore behavior.
2. Audit route-level loading, empty, error and retry states against actual routes.
3. Test deep-link restoration with session/authorization rechecks; never restore protected content from client cache alone.
4. Exercise mobile safe areas and virtual-keyboard layouts on real devices.
