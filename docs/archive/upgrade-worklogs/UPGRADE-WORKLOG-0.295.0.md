# Upgrade Worklog — 0.295.0

## Phase 8 — Global locale presentation

Implemented a shared formatting module for compact numbers, percentages, units, relative time, plural selection, locale-aware collation and locale presentation metadata. Exposed all helpers through regional context and applied locale-aware digit grouping to notification-centre counts and unread badges. Bumped translation catalog governance to version 5 and updated project release/source-of-truth documentation.

## Safety boundaries

No Supabase migration, database write, auth/session change, wallet/ledger change, Pi payment/payout change, or financial calculation change. Formatting is display-only. User-generated content is not translated.

## Verification status

Source-only verification was run; source-contract checks are recorded separately. TypeScript, lint and production build require Node.js 24.15.0 and complete dependencies; do not infer those gates from static checks.
