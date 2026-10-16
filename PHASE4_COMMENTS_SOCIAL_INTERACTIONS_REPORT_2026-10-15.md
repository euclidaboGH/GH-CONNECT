# GreenHaven Phase 4 — Comments & Social Interactions

Date: 2026-10-15

## Implemented

1. Added stable cursor pagination for durable comments via `gh_comment_list_v2`, ordered by `(created_at, id)` to avoid duplicate/omitted rows at identical timestamps.
2. Kept a legacy `gh_comment_list` fallback so deployment remains compatible before the additive migration is applied.
3. Added API cursor validation and `nextCursor` / `stableCursor` response metadata; extended `socialListComments()` to consume it.
4. Hardened comment parent integrity: durable creation now rejects missing, deleted, orphaned, or cross-post reply parents.
5. Made duplicate comment IDs idempotent at the RPC boundary, reducing double-submit risk.
6. Removed client authority over comment display identity. `authorName` and `authorPhoto` are now resolved from the authenticated server profile/session.
7. Corrected reply notifications: the parent-comment author is the primary reply recipient. The post owner receives separate conversation activity only when appropriate, avoiding duplicate recipient notifications.
8. Reworked @mention resolution from one profile request per handle to one batched profile lookup (max 5 mentions), eliminating the N+1 lookup pattern.
9. Mention/reply notification failures remain non-blocking and cannot roll back a successfully persisted comment.
10. Reaction and curation routes were audited: actor identity remains session-authoritative; curation remains quality-only at this mutation boundary with no direct GHC settlement.

## Migration

Apply `supabase/migrations/202610150002_gh_comment_stable_cursor.sql` before expecting `stableCursor: true`. Until then the API intentionally falls back to the existing list RPC.

## Verification

- `node scripts/check-jsx-safety.mjs` — PASS (613 files scanned).
- Full dependency build was not claimed in this extracted workspace; deployment/build verification should still run in the project's normal Node/Vercel environment.

## Scope protection

No wallet balances, GHC reward amounts, membership entitlements, Pi payments, escrow, marketplace order logic, or withdrawal logic were changed.
