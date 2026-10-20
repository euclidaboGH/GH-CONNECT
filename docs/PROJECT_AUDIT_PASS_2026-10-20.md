# Project audit pass — 2026-10-20 (0.63.5)

## Environment limits
- Full `npm ci` in this sandbox OOMs (exit 137) or hits registry issues; Vercel remains the production typecheck authority.
- No live Supabase / two-account cookies in agent environment — social durable proof remains operator-side (`operator:live-e2e-social`).

## Issues found & fixed this pass
1. **DurableMediaResult narrowing** — Success branch has no `userMessage`. Added `mediaUploadErrorMessage()` and applied it in compose, DM attach, and profile photo error paths.
2. **Discover candidates** — Server-hydrated people now set `isSample: false` and preserve `distance` for consistent Candidate typing.
3. **Message media import** — Dynamic import now includes `mediaUploadErrorMessage` with `uploadDurableMedia`.

## Verified already present (no change required)
- Conversation hydrate defaults include `online` + `conversationType`
- Candidate hydrate includes `verified` / `online` / `lastSeen`
- `useGHCMessaging` exposes `loadConversationMessages`
- Comment sheet uses string `kind` for media (avoids gif|voice vs video exhaustiveness)
- Connection accept/decline server-first + inbox rehydrate (Phase 3)
- Comment soft-poll + parent server lookup (Phase 4)
- Phase 5 operator gate + expanded E2E stages

## Residual risks (operator)
| Risk | Action |
|------|--------|
| Migrations not applied | `npm run operator:multiuser-migrations` + apply REQUIRED SQL on target DB |
| Social not durable | Run live E2E with A/B cookies |
| npm lockfile on Vercel | Prefer `registry.npmjs.org` only (no private IP resolved URLs) |
| Economy activity rewards | Flag-gated; do not enable without Testnet evidence |

## Intentionally not rewritten
Ledger, RLS, Pi payment authority, membership pricing, fake balances, demo feed invention.
