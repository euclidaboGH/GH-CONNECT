# Matches section audit (2026-10-11)

## Canonical surface

| Module | Role |
|--------|------|
| `MatchScreen` | Active Matches tab |
| `matches-components` | Cards, tabs, filters, empty |
| `match-celebration` | Mutual-interest modal (shell) |
| `matches-screen.tsx` | Re-export only |

## Critical fixes

1. **Viewer identity** — mutual-like filter uses real `meId` (+ legacy `current-user`)
2. **Blocked users** filtered out of the list
3. **Remove** calls `rejectMatch` → `domains.graph.removeMatch` when available
4. Auto intro message only when **online**
5. Celebration CTAs use brand token
6. List item semantics
7. Prior: offline, Escape, tab a11y, counts, honest status

## Product boundary

- Match = mutual interest (not auto-friend)
- Connect = unified request + intents
- Message = private conversation
- Remove uses graph unmatch when domain supports it

## Safety

- No fabricated matches
- No silent like-as-connect
- Local hide fallback only if rejectMatch missing
