# Upgrade worklog — 0.330.31

## Scope

Priority 7 — Communities: discovery and participation correctness increment, building on the 0.330.30 governance and resource-safety work.

## Audit findings and changes

- The remote community directory can intentionally contain only a partial member-ID projection (for example, the owner and current viewer) while also carrying the server's aggregate `memberCount`. The “Most members” sort incorrectly ranked by the partial `members.length`; it now uses the explicit aggregate count and falls back to the ID list only when no valid aggregate exists.
- The “Needs attention” sort added `boardUnread`, `chatUnread` and legacy `unreadCount` together. Because `unreadCount` is a legacy chat fallback, this could double-count chat activity. Ranking and the Community pulse now use one shared non-negative counter policy with `unreadCount` used only when `chatUnread` is absent.
- Event date normalization previously accepted numeric millisecond timestamps only. ISO date strings and Unix-second timestamps now normalize to milliseconds; malformed and out-of-range dates remain unknown rather than rendering as misleading dates.
- External community resource links now reject embedded URL credentials in addition to the existing HTTPS/same-origin-relative allowlist.
- Community directory cards now distinguish pending join requests from new join actions, and expose Accept/Decline controls for existing invitations using the canonical context/domain mutations. The Community hub also prevents a duplicate join request while an invitation or request is already active.
- Community privacy mode is normalized without collapsing approval-required and invite-only communities into public access.
- Added focused source and runtime regression contracts and registered them in `prebuild` and `verify:static`.

## Preserved boundaries

No database migration, membership/join authority, community roles, moderation decisions, chat policy, report-review authority, wallet, GHC, Pi, payment, ledger, reward, payout or entitlement behavior changed. No server data was fabricated and no governance durability claim was upgraded.

## Verification and release boundary

This increment is source-only; the Priority 7 transformation contracts, runtime normalization/discovery tests, and consolidated `verify:static` suite are required. The available environment is Node.js 22.16.0 while the project requires Node.js 24.15.0; dependency-backed TypeScript, ESLint and Next.js production build have not been run. Browser/device, live Supabase/RLS, Testnet and operator acceptance remain outstanding. Production is NOT APPROVED.
