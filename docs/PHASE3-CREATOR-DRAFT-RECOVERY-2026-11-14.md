# Phase 3 — Creator Draft Recovery Increment

Date: 2026-11-14  
Baseline: `gh-connect@0.338.67`

## Delivered

- Added a bounded saved-draft browser to the canonical `UnifiedCompose` surface.
- Drafts continue to be loaded through the account-scoped `post-drafts` service; the unscoped legacy key is not imported.
- The list listens for the existing `ghc:post-drafts-changed` event so it refreshes after save/delete operations.
- Draft restore preserves the current edits before switching to another draft.
- Restoring a draft restores text, visibility, community target, durable image/video/document references and publish request idempotency metadata.
- The picker displays at most the supported 20 drafts and excludes the active draft from deletion.
- Switching/deleting is disabled while publish or upload work is pending.
- Added a focused source-contract check and registered it in the required pre-typecheck gate.

## Verification

Passed in the available Node 22.16.0 environment:

- `scripts/check-phase3-creator-draft-recovery.mjs`: 11/11
- `scripts/check-phase3-creator-media-hardening.mjs`: 13/13
- `scripts/check-phase3-upload-cancellation-identity.mjs`: 12/12
- `scripts/check-phase2-account-switch-engagement.mjs`: 15/15
- `scripts/test-phase2-account-switch-engagement.mjs`: 7/7
- `scripts/check-phase1-unified-post-architecture.mjs`: 14/14
- `scripts/check-project-truth.mjs`: 11/11
- `scripts/check-jsx-safety.mjs`: 1,099 files passed

## Release limitations

The repository requires Node.js `^24.15.0`, but the available runtime is Node.js `22.16.0`. Project dependencies are not installed in this environment. Therefore full TypeScript, ESLint, production build and browser/device E2E checks are not certified by this increment. The focused checks are source-contract tests, not live end-to-end proof.

No database migrations, wallet/Pi/GHC authority changes, GitHub push or Vercel deployment were performed.
