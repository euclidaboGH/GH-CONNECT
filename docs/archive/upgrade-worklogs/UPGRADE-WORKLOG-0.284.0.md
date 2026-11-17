# GreenHaven 0.284.0 — Messaging inbox production upgrade

Date: 2026-11-03

## Scope
Continue massive upgrades after video gap-fill: message inbox identity, soft refresh, pull-to-refresh.

## Changes
- Inbox rows enrich `participantName` / `participantPhoto` from candidates, friends, and matches when the conversation payload is incomplete.
- `ConversationItem` uses safe `displayName` (never blank User/Unknown).
- Pull-to-refresh on inbox list + soft-refresh reloads conversation list, not only open threads.
- Candidates/friends/matches wired from `useGHC` into the messages shell object.

## Verification
`node scripts/check-phase6-messaging-inbox.mjs`
Prior phase gates remain registered under verify:static.
