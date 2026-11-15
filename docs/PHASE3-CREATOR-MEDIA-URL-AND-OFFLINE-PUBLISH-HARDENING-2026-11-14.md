# Phase 3 — Creator Media URL & Offline Publishing Hardening

## Baseline

Applied to the supplied GH-CONNECT `0.338.67` project archive. This is an additive hardening increment to the existing `UnifiedCompose` and media upload paths. It does not introduce a second composer, change database schemas, alter Pi authentication authority, issue GHC rewards, or modify wallet/payment settlement.

## Changes

- Replaced permissive durable-media URL acceptance with an explicit scheme policy: HTTPS absolute URLs, loopback HTTP for local development, and same-origin root-relative paths only.
- Rejected protocol-relative external URLs, embedded URL credentials, unsupported schemes (`javascript:`, `vbscript:`, `file:`, `filesystem:`, `blob:`, and `data:`), control characters, backslashes, placeholders, malformed and overlong URLs.
- Reused the same canonical policy when reading/writing account-scoped post drafts, covering images, videos and document attachments.
- Removed the misleading Feed-post offline fallback that placed a local data URL into the attachment list. The composer now explains that the photo was not attached and must be re-selected after reconnecting; text remains eligible for draft autosave.
- Added a fail-closed story publish guard for local-only/non-durable preview media, preventing an offline data URL from being submitted as a published story attachment.
- Added focused source and runtime tests and registered both in the prebuild and pretypecheck gates.

## Verification performed

- Durable media source gate: 7/7.
- Durable media URL runtime assertions: 19/19.
- Creator draft recovery gate: 11/11.
- Creator media hardening gate: 13/13.
- Upload cancellation/identity gate: 12/12.
- Phase 2 engagement hardening: 11/11.
- Phase 2 account/count/notification gate: 15/15.
- Account-switch runtime contract: 7/7.
- Phase 1 unified post architecture: 14/14.
- Project truth/integrity: 11/11.
- Package JSON parsed successfully.

## Release limits

The environment uses Node.js `22.16.0`; this project pins Node.js `24.15.0` and dependencies are not installed. Full TypeScript, ESLint, production build, browser/device, interrupted-network, and live two-account acceptance remain unverified. No migrations, GitHub push, or Vercel deployment were performed. Production remains NOT APPROVED until the required release gates pass in the supported environment.
