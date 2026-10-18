# GreenHaven Social Conversations Upgrade — 2026-10-18

## Scope

This pass focuses on reliability in shared comments/replies (including feed-backed community posts) and private/community messaging. It deliberately uses the existing server-authoritative stores and existing `gh_messages.meta` JSONB field rather than adding a new migration.

## Changes

- Comment sheet now reports refresh failures and offers a retry action instead of silently implying the comment list refreshed.
- Comment deletion and reaction failures are surfaced to the user.
- Comment reaction controls show per-emoji totals rather than treating any user's reaction as if it were the current viewer's own reaction.
- Message replies now use the canonical send pipeline rather than only adding a local reply object.
- Durable message POST accepts an optional reply target; the server verifies that the target is an undeleted message in the same conversation. The target is never accepted based on client-supplied sender identity.
- Reply target and a bounded preview are stored in the existing `gh_messages.meta` JSONB field. Existing messages remain compatible and do not require a migration.
- Reply metadata is preserved across normal sends, retry attempts, offline queue flushes, and message hydration.
- Message send functions return an explicit accepted/rejected result so the composer does not report success when the canonical send pipeline rejects a message. Failed sends retain the draft and reply context.
- Story reactions and story replies now respect the messaging send result before displaying success.
- ISO timestamps returned by the durable messages API are parsed correctly rather than falling back to the current time.
- Added static regression tests and wired them into `ci:verify`.

## Validation performed

Passed:
- JSX safety scan (633 files)
- Messaging authorization scan (12 checks)
- Social comments/replies/messaging regression checks (14 checks)
- Story creator regression checks (12 checks)
- Post composer regression checks (16 checks)
- Engagement roster security checks (10 checks)
- Social authorization static scan (37 checks)
- IDOR static scan (132 checks)
- Production safety scan (21 checks)
- TypeScript parser syntax checks for the modified TS/TSX/JS files

Not verified in this environment:
- Full `next build`, TypeScript typecheck with project dependencies, and ESLint, because project dependencies are not installed in this working environment. A global `tsc --noEmit` run reports missing dependency/type declarations (for example `next/server`, React and Node types), so it cannot establish a clean typecheck.
- Live Testnet database, two-account messaging, realtime delivery, or mobile UI behavior.

## Deployment guidance

No new Supabase migration is required. Test on the Vercel Preview/Testnet deployment with two accounts before promoting. Specifically test: nested comment/reply creation, reactions, deletion permissions, a message reply after refresh, a reply to a deleted/missing message, offline queue flush, story reply, and message-send failure recovery.
